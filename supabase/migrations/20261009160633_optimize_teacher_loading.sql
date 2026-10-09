-- Reduce transferred history without changing due-date/payment-date accounting.
create index if not exists payments_owner_date_id_idx on public.payments(user_id, payment_date, id);
create index if not exists invoices_owner_created_no_due_idx on public.invoices(user_id, created_at) where due_date is null;
create index if not exists sessions_owner_date_idx on public.sessions(user_id, session_date);

create or replace function public.get_billing_summary()
returns table(month_key text, estimated_income numeric, income numeric, payment_count bigint, student_count bigint)
language plpgsql stable security invoker set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_tz text;
begin
  if v_uid is null or not private.app_accessible(v_uid) then
    raise exception 'Tidak terautentikasi atau akses akun dibatasi.' using errcode='42501';
  end if;
  select coalesce(p.timezone,'Asia/Jakarta') into v_tz from public.profiles p where p.id=v_uid;
  v_tz := coalesce(v_tz,'Asia/Jakarta');
  return query
    with estimates as (
      select coalesce(to_char(i.due_date,'YYYY-MM'),to_char(i.created_at at time zone v_tz,'YYYY-MM')) as month,
        sum(i.amount) as total
      from public.invoices i where i.user_id=v_uid group by 1
    ), received as (
      select to_char(p.payment_date,'YYYY-MM') as month, sum(p.amount) as total,
        count(*) as payments, count(distinct p.student_id) as students
      from public.payments p where p.user_id=v_uid group by 1
    )
    select coalesce(e.month,r.month), coalesce(e.total,0), coalesce(r.total,0),
      coalesce(r.payments,0), coalesce(r.students,0)
    from estimates e full join received r on r.month=e.month order by 1;
end $$;

create or replace function public.get_month_invoices(p_month text)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_start date; v_end date; v_tz text; v_result jsonb;
begin
  if v_uid is null or not private.app_accessible(v_uid) then
    raise exception 'Tidak terautentikasi atau akses akun dibatasi.' using errcode='42501';
  end if;
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or left(p_month,4)='0000' then
    raise exception 'Bulan tidak valid.' using errcode='22023';
  end if;
  v_start := (p_month||'-01')::date;
  v_end := (v_start+interval '1 month')::date;
  select coalesce(p.timezone,'Asia/Jakarta') into v_tz from public.profiles p where p.id=v_uid;
  v_tz := coalesce(v_tz,'Asia/Jakarta');
  select coalesce(jsonb_agg(to_jsonb(row) order by row.created_at desc,row.id desc),'[]'::jsonb) into v_result
  from (
    select i.id,i.student_id,i.invoice_number,i.type,i.period_label,i.amount,i.due_date,i.status,i.created_at,
      jsonb_build_object('full_name',s.full_name) as students,
      coalesce(paid.amount,0) as paid_amount
    from public.invoices i left join public.students s on s.id=i.student_id
    left join lateral (
      select sum(p.amount) as amount from public.payments p where p.user_id=v_uid and p.invoice_id=i.id
    ) paid on true
    where i.user_id=v_uid and (
      (i.due_date>=v_start and i.due_date<v_end)
      or (i.due_date is null and i.created_at>=(v_start::timestamp at time zone v_tz)
        and i.created_at<(v_end::timestamp at time zone v_tz))
    )
  ) row;
  return v_result;
end $$;

create or replace function public.get_report_invoice_balances(p_from date,p_to date,p_student uuid default null)
returns table(student_id uuid, balance numeric)
language plpgsql stable security invoker set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not private.app_accessible(v_uid) then
    raise exception 'Tidak terautentikasi atau akses akun dibatasi.' using errcode='42501';
  end if;
  return query select i.student_id,sum(greatest(0,i.amount-coalesce(paid.amount,0)))
  from public.invoices i left join lateral (
    select sum(p.amount) as amount from public.payments p where p.user_id=v_uid and p.invoice_id=i.id
  ) paid on true
  where i.user_id=v_uid and i.status<>'paid' and i.due_date between p_from and p_to
    and (p_student is null or i.student_id=p_student)
  group by i.student_id;
end $$;

revoke all on function public.get_billing_summary(),public.get_month_invoices(text),
  public.get_report_invoice_balances(date,date,uuid) from public,anon;
grant execute on function public.get_billing_summary(),public.get_month_invoices(text),
  public.get_report_invoice_balances(date,date,uuid) to authenticated;

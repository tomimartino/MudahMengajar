-- Payment state determines notification text; the due date only determines reminder timing.
-- Keep the existing keys, read state, sent state, and account-access guards.
create or replace function private.refresh_payment_reminders(p_uid uuid, p_now timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_item record;
  v_today date;
  v_type text;
  v_key text;
  v_keys text[] := '{}';
begin
  if p_uid is null or p_now is null or not private.app_accessible(p_uid) then return; end if;
  select (p_now at time zone coalesce(timezone, 'Asia/Jakarta'))::date into v_today
    from public.profiles where id = p_uid;
  if v_today is null then return; end if;

  for v_item in
    select i.id, i.invoice_number, i.status, i.due_date, i.period_label, st.full_name
    from public.invoices i
    join public.students st on st.id = i.student_id and st.user_id = i.user_id
    join public.settings settings on settings.user_id = i.user_id
    where i.user_id = p_uid and i.status in ('unpaid', 'partial') and st.deleted_at is null
      and settings.notify_payment and i.due_date is not null
      and i.due_date <= v_today + settings.payment_reminder_days
  loop
    v_type := case when v_item.due_date < v_today then 'payment_overdue' else 'payment_due' end;
    v_key := v_type || ':' || v_item.id;
    v_keys := array_append(v_keys, v_key);
    insert into public.notifications(user_id, type, ref_key, title, body, link)
      values(p_uid, v_type, v_key,
        case when v_item.status = 'partial' then 'Sebagian' else 'Belum Bayar' end || ' · ' || v_item.full_name,
        v_item.invoice_number || ' (' || coalesce(v_item.period_label, 'tagihan') || ') ' ||
          case when v_item.status = 'partial' then 'baru dibayar sebagian.' else 'belum dibayar.' end ||
          ' Tenggat: ' || to_char(v_item.due_date, 'DD Mon YYYY') || '.',
        '/payments?month=' || to_char(v_item.due_date, 'YYYY-MM'))
      on conflict(user_id, ref_key) do update
        set title = excluded.title, body = excluded.body, link = excluded.link
      where (notifications.title, notifications.body, notifications.link)
        is distinct from (excluded.title, excluded.body, excluded.link);
  end loop;
  delete from public.notifications where user_id = p_uid
    and type in ('payment_due', 'payment_overdue') and not (ref_key = any(v_keys));
end $$;
revoke all on function private.refresh_payment_reminders(uuid, timestamptz) from public, anon, authenticated;

-- Replace only the payment block in the deployed function, retaining the ERP guard
-- and independent schedule/material/package reminders from preceding migrations.
do $$
declare v_definition text; v_start integer; v_end integer;
begin
  select pg_get_functiondef('public.refresh_reminders_for_user(uuid)'::regprocedure) into v_definition;
  v_start := strpos(v_definition, '  if v_stg.notify_payment then');
  v_end := strpos(v_definition, '  if v_stg.notify_package then');
  if v_start = 0 or v_end <= v_start
    or strpos(v_definition, '''payment_due'', ''payment_overdue'', ''package_low''') = 0 then
    raise exception 'Unexpected reminder function; payment block was not replaced.';
  end if;
  v_definition := left(v_definition, v_start - 1) ||
    E'  perform private.refresh_payment_reminders(p_uid, now());\n\n' || substring(v_definition from v_end);
  v_definition := replace(v_definition, '''payment_due'', ''payment_overdue'', ''package_low''', '''package_low''');
  execute v_definition;
end $$;

-- Correct existing notification text immediately, without resetting read/sent state.
do $$ declare v_uid uuid; begin
  for v_uid in select distinct user_id from public.notifications where type in ('payment_due', 'payment_overdue') loop
    perform private.refresh_payment_reminders(v_uid, now());
  end loop;
end $$;

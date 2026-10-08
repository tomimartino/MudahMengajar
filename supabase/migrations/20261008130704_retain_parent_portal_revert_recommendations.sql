-- Restore the original teacher features while retaining the read-only parent portal.
-- Never remove independent homework, answers, files or payment attempts unnoticed.
do $$
begin
  if exists(select 1 from public.homework_submissions)
    or exists(select 1 from public.payment_orders)
    or exists(select 1 from storage.objects where bucket_id='homework')
    or exists(select 1 from public.students where deleted_at is not null)
    or exists(
      select 1 from public.assignments a where not a.from_session or not exists(
        select 1 from public.sessions s where s.id=a.session_id
          and s.user_id=a.user_id and s.student_id=a.student_id
          and btrim(s.homework)=a.description
      )
    ) then
    raise exception 'Retired features contain independent data; preserve that data before reverting';
  end if;
end $$;

drop trigger session_assignment_sync on public.sessions;
drop trigger schedule_conflict on public.schedules;
drop trigger protect_online_payment on public.payments;
drop trigger protect_online_invoice on public.invoices;
do $$ declare t text; begin
  foreach t in array array['students','schedules','sessions','attendance','invoices','payments',
    'student_packages','expenses','assignments','homework_submissions','payment_orders'] loop
    execute format('drop trigger audit_change on public.%I',t);
  end loop;
end $$;

drop function private.session_assignment_trigger();
drop function private.sync_session_assignment(uuid,boolean);
drop function private.capture_audit();
drop function private.check_schedule_conflict();
drop function private.protect_pending_payment();
drop function public.restore_session_revision(uuid);
drop function public.archive_student(uuid,boolean);
drop function public.reschedule_teacher(uuid,timestamptz,timestamptz);
drop function public.portal_submit_homework(text,uuid,text,text,text);
drop function public.reserve_midtrans_order(uuid,text);
drop function public.apply_midtrans_status(text,numeric,text,text);

-- Balances still come from the existing invoices and manual payment records.
create or replace function public.portal_invoice_balances(p_hash text) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from (
    select inv.id,inv.invoice_number,inv.period_label,inv.amount,inv.due_date,inv.status,
      coalesce((select sum(p.amount) from public.payments p
        where p.invoice_id=inv.id and p.user_id=inv.user_id),0) paid_total
    from public.invoices inv join private.portal_student(p_hash) s
      on s.id=inv.student_id and s.user_id=inv.user_id
    order by inv.created_at desc limit 100
  ) i
$$;
revoke all on function public.portal_invoice_balances(text) from public,anon,authenticated;
grant execute on function public.portal_invoice_balances(text) to service_role;

drop table public.homework_submissions;
drop table public.assignments;
drop table public.payment_orders;
drop table public.audit_logs;
drop function private.validate_learning_owner();
drop policy homework_teacher_read on storage.objects;
-- Remove the empty homework bucket separately through the Storage API.
delete from public.notifications where ref_key like 'homework:%'
  or ref_key like 'booking:%' or ref_key like 'payment-refund:%' or ref_key like 'payment-paid:%';

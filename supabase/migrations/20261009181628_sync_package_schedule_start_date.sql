-- Schedule mutations keep both package dates in sync with its own meetings.
-- Callers retain the package -> invoice -> schedule lock order.
-- The legacy start_date column stores the deadline; the form stores the first date.
create or replace function private.sync_package_schedule_due_date(p_package_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare
  v_uid uuid := auth.uid(); v_pkg public.student_packages;
  v_first date; v_due date; v_tz text; v_settings jsonb;
begin
  select * into v_pkg from public.student_packages where id=p_package_id and user_id=v_uid;
  if not found then return; end if;
  select coalesce(timezone,'Asia/Jakarta') into v_tz from public.profiles where id=v_uid;
  select min((start_at at time zone coalesce(v_tz,'Asia/Jakarta'))::date),
    max((start_at at time zone coalesce(v_tz,'Asia/Jakarta'))::date)
    into v_first,v_due
    from public.schedules where package_id=v_pkg.id and student_id=v_pkg.student_id
      and user_id=v_uid and status<>'cancelled';
  -- With no remaining meetings, retain the last known dates for package history.
  if v_first is not null then
    v_settings := jsonb_set(coalesce(v_pkg.form_settings,'{}'::jsonb),
      '{schedule_start_date}',to_jsonb(v_first));
    update public.student_packages set start_date=v_due,form_settings=v_settings
      where id=v_pkg.id and user_id=v_uid
        and (start_date is distinct from v_due or form_settings is distinct from v_settings);
    update public.invoices set due_date=v_due
      where id=v_pkg.invoice_id and user_id=v_uid and student_id=v_pkg.student_id
        and due_date is distinct from v_due;
  end if;
end $$;
revoke all on function private.sync_package_schedule_due_date(uuid) from public,anon;
grant execute on function private.sync_package_schedule_due_date(uuid) to authenticated;

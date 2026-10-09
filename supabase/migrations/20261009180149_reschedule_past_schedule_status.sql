-- Past reschedules follow the same completion rule as newly created package schedules.
-- Keep recorded lesson status and content; automatic completion creates no lesson/deduction.
create or replace function public.move_schedule(p_schedule_id uuid,p_date date,p_time time without time zone)
returns void language plpgsql security invoker set search_path='' as $$
declare
  v_uid uuid := auth.uid(); v_sched public.schedules; v_pkg public.student_packages;
  v_original_package uuid; v_tz text; v_start timestamptz; v_end timestamptz; v_shift interval;
begin
  if v_uid is null then raise exception 'Tidak terautentikasi.'; end if;
  if p_date is null or p_time is null or not isfinite(p_date) or p_time>=time '24:00' then
    raise exception 'Tanggal atau jam tidak valid.';
  end if;
  select * into v_sched from public.schedules where id=p_schedule_id and user_id=v_uid;
  if not found or v_sched.status not in ('scheduled','completed') then
    raise exception 'Jadwal tidak ditemukan atau sudah dibatalkan.';
  end if;
  v_original_package:=v_sched.package_id;
  -- Match package editing/cancellation lock order; never guess another package.
  select * into v_pkg from public.student_packages
    where id=v_original_package and user_id=v_uid and student_id=v_sched.student_id for update;
  perform 1 from public.invoices where id=v_pkg.invoice_id and user_id=v_uid for update;
  select * into v_sched from public.schedules where id=p_schedule_id and user_id=v_uid
    and package_id is not distinct from v_original_package for update;
  if not found or v_sched.status not in ('scheduled','completed') then
    raise exception 'Jadwal sudah berubah. Muat ulang halaman.';
  end if;
  if not exists(select 1 from public.students where id=v_sched.student_id and user_id=v_uid and deleted_at is null) then
    raise exception 'Murid tidak ditemukan.';
  end if;
  select coalesce(timezone,'Asia/Jakarta') into v_tz from public.profiles where id=v_uid;
  v_start:=(p_date+p_time) at time zone coalesce(v_tz,'Asia/Jakarta');
  v_end:=v_start+(v_sched.end_at-v_sched.start_at);
  v_shift:=v_start-v_sched.start_at;
  update public.schedules set start_at=v_start,end_at=v_end,
    status=case when v_end<=now() then 'completed' else v_sched.status end
    where id=v_sched.id and user_id=v_uid;
  update public.sessions set session_date=p_date,started_at=started_at+v_shift,ended_at=ended_at+v_shift
    where schedule_id=v_sched.id and user_id=v_uid;
  perform private.sync_package_schedule_due_date(v_pkg.id);
end $$;
revoke all on function public.move_schedule(uuid,date,time without time zone) from public,anon;
grant execute on function public.move_schedule(uuid,date,time without time zone) to authenticated;

-- A rombel still has one bill whether its optional headcount is known or not.
alter table public.students drop constraint students_group_size_check;
alter table public.students add constraint students_group_size_check check (
  (teaching_type='private' and group_size is null) or
  (teaching_type='group' and (group_size is null or group_size between 2 and 1000))
);

-- Keep the actual deduction, independent of later attendance/policy edits.
-- Existing lessons are deliberately marked unknown; never invent a historical deduction.
alter table public.sessions
  add column package_deduction_recorded boolean not null default false,
  add column deducted_package_id uuid references public.student_packages(id) on delete set null;
alter table public.sessions alter column package_deduction_recorded set default true;
create index sessions_deducted_package_idx on public.sessions(deducted_package_id)
  where deducted_package_id is not null;

-- Callers lock package -> invoice -> schedule before invoking this helper.
-- start_date is the existing package deadline field, not the first lesson date.
create function private.sync_package_schedule_due_date(p_package_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare
  v_uid uuid := auth.uid(); v_pkg public.student_packages; v_due date; v_tz text;
begin
  select * into v_pkg from public.student_packages where id=p_package_id and user_id=v_uid;
  if not found then return; end if;
  select coalesce(timezone,'Asia/Jakarta') into v_tz from public.profiles where id=v_uid;
  select max((start_at at time zone coalesce(v_tz,'Asia/Jakarta'))::date) into v_due
    from public.schedules where package_id=v_pkg.id and student_id=v_pkg.student_id
      and user_id=v_uid and status<>'cancelled';
  -- A package with no remaining meetings keeps its last known date.
  if v_due is not null then
    update public.student_packages set start_date=v_due
      where id=v_pkg.id and user_id=v_uid and start_date is distinct from v_due;
    update public.invoices set due_date=v_due
      where id=v_pkg.invoice_id and user_id=v_uid and student_id=v_pkg.student_id
        and due_date is distinct from v_due;
  end if;
end $$;
revoke all on function private.sync_package_schedule_due_date(uuid) from public,anon;
grant execute on function private.sync_package_schedule_due_date(uuid) to authenticated;

create or replace function public.move_schedule(p_schedule_id uuid,p_date date,p_time time without time zone)
returns void language plpgsql security invoker set search_path='' as $$
declare
  v_uid uuid := auth.uid(); v_sched public.schedules; v_pkg public.student_packages;
  v_original_package uuid; v_tz text; v_start timestamptz; v_shift interval;
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
  -- An unlinked schedule must not alter an unrelated active package or bill.
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
  v_shift:=v_start-v_sched.start_at;
  update public.schedules set start_at=v_start,end_at=v_start+(v_sched.end_at-v_sched.start_at)
    where id=v_sched.id and user_id=v_uid;
  update public.sessions set session_date=p_date,started_at=started_at+v_shift,ended_at=ended_at+v_shift
    where schedule_id=v_sched.id and user_id=v_uid;
  perform private.sync_package_schedule_due_date(v_pkg.id);
end $$;
revoke all on function public.move_schedule(uuid,date,time without time zone) from public,anon;
grant execute on function public.move_schedule(uuid,date,time without time zone) to authenticated;

create or replace function public.cancel_schedule(p_schedule_id uuid,p_reduce_price boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
declare
  v_uid uuid:=auth.uid(); v_sched public.schedules; v_original_package uuid; v_package_id uuid;
  v_pkg public.student_packages; v_invoice public.invoices; v_session public.sessions;
  v_paid numeric; v_price numeric; v_total int; v_used int; v_reverse boolean:=false;
  v_known int; v_unknown int;
begin
  if v_uid is null then raise exception 'Tidak terautentikasi.'; end if;
  select * into v_sched from public.schedules where id=p_schedule_id and user_id=v_uid;
  if not found or v_sched.status not in ('scheduled','completed') then
    raise exception 'Jadwal tidak ditemukan atau sudah dibatalkan.';
  end if;
  v_original_package:=v_sched.package_id;
  select * into v_session from public.sessions where schedule_id=v_sched.id and user_id=v_uid;
  v_package_id:=coalesce(v_original_package,v_session.deducted_package_id);
  if v_package_id is null and v_sched.status='scheduled' then
    -- Preserve the scheduled/manual legacy behavior only when ownership is unambiguous.
    select (array_agg(id))[1] into v_package_id from public.student_packages
      where user_id=v_uid and student_id=v_sched.student_id and status='active' having count(*)=1;
  end if;
  select * into v_pkg from public.student_packages
    where id=v_package_id and user_id=v_uid and student_id=v_sched.student_id for update;
  select * into v_invoice from public.invoices where id=v_pkg.invoice_id and user_id=v_uid for update;
  select * into v_sched from public.schedules where id=p_schedule_id and user_id=v_uid
    and package_id is not distinct from v_original_package for update;
  if not found or v_sched.status not in ('scheduled','completed') then
    raise exception 'Jadwal sudah berubah. Muat ulang halaman.';
  end if;
  select * into v_session from public.sessions where schedule_id=v_sched.id and user_id=v_uid for update;
  if v_sched.status='completed' and v_session.id is not null and v_pkg.id is not null then
    if v_session.package_deduction_recorded then
      v_reverse:=v_session.deducted_package_id=v_pkg.id;
    else
      -- Old versions stored only the aggregate. Resolve only all/none cases from the
      -- remaining lessons; partial historical usage cannot safely identify a deduction.
      select count(*) filter(where s.package_deduction_recorded and s.deducted_package_id=v_pkg.id),
        count(*) filter(where not s.package_deduction_recorded and sc.package_id=v_pkg.id)
        into v_known,v_unknown
      from public.sessions s left join public.schedules sc on sc.id=s.schedule_id
      where s.user_id=v_uid and s.student_id=v_pkg.student_id and s.status='completed'
        and (s.deducted_package_id=v_pkg.id or sc.package_id=v_pkg.id);
      if v_pkg.sessions_used<=v_known then v_reverse:=false;
      elsif v_pkg.sessions_used-v_known=v_unknown then v_reverse:=true;
      else raise exception 'Pemakaian paket lama tidak dapat dipastikan. Periksa jumlah pertemuan terpakai pada paket terlebih dahulu.';
      end if;
    end if;
  end if;
  v_used:=greatest(v_pkg.sessions_used-case when coalesce(v_reverse,false) then 1 else 0 end,0);
  if p_reduce_price and v_pkg.id is not null and v_pkg.status in ('active','completed') and v_pkg.per_session_rate>0 then
    v_total:=greatest(v_pkg.total_sessions-1,v_used);
    v_price:=greatest(v_pkg.price-v_pkg.per_session_rate,0);
    select coalesce(sum(amount),0) into v_paid from public.payments where invoice_id=v_invoice.id and user_id=v_uid;
    if v_paid>v_price then raise exception 'Pembatalan melebihi sisa tagihan. Sesuaikan pembayaran terlebih dahulu.'; end if;
    update public.student_packages set total_sessions=v_total,sessions_used=v_used,price=v_price,
      status=case when v_total=0 then 'cancelled' when v_total=v_used then 'completed' else 'active' end
      where id=v_pkg.id and user_id=v_uid;
    update public.invoices set amount=v_price,period_label='Paket '||v_total||'x Pertemuan',
      status=case when v_paid>=v_price then 'paid' when v_paid>0 then 'partial' else 'unpaid' end
      where id=v_invoice.id and user_id=v_uid;
  elsif coalesce(v_reverse,false) then
    update public.student_packages set sessions_used=v_used where id=v_pkg.id and user_id=v_uid;
  end if;
  update public.schedules set status='cancelled' where id=p_schedule_id and user_id=v_uid;
  update public.sessions set status='cancelled' where id=v_session.id and user_id=v_uid;
  update public.attendance set status='dibatalkan_guru' where session_id=v_session.id and user_id=v_uid;
  perform private.sync_package_schedule_due_date(v_pkg.id);
end $$;
revoke all on function public.cancel_schedule(uuid,boolean) from public,anon;
grant execute on function public.cancel_schedule(uuid,boolean) to authenticated;

-- Snapshot actual deductions while completing a lesson; retain the existing locking and access checks.
-- Read the current schedule after acquiring its lock; package edits may have changed dates.
create or replace function public.complete_session(
  p_schedule_id uuid,
  p_attendance text,
  p_duration_minutes int,
  p_material text default null,
  p_sub_material text default null,
  p_learning_notes text default null,
  p_homework text default null,
  p_score numeric default null,
  p_progress_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_sched record;
  v_session_id uuid;
  v_pkg record;
  v_package_id uuid;
  v_policy text;
  v_deduct boolean;
begin
  if v_uid is null or not private.app_accessible(v_uid) then raise exception 'Akun tidak dapat mengakses aplikasi.' using errcode='42501'; end if;
  if v_uid is null then
    raise exception 'Tidak terautentikasi' using errcode = 'P0001';
  end if;
  if p_attendance is null or p_attendance not in ('hadir', 'izin', 'sakit', 'alpha', 'dibatalkan_guru', 'dibatalkan_siswa') then
    raise exception 'Status kehadiran tidak valid' using errcode = 'P0001';
  end if;

  if p_duration_minutes is null or p_duration_minutes<=0 then raise exception 'Durasi tidak valid.'; end if;

  select coalesce(p.timezone, 'Asia/Jakarta') into v_tz from public.profiles p where p.id = v_uid;

  select * into v_sched from public.schedules
    where id=p_schedule_id and user_id=v_uid and status='scheduled';
  if not found then raise exception 'Jadwal tidak ditemukan atau sudah selesai'; end if;
  v_package_id:=v_sched.package_id;
  if v_package_id is null then
    select (array_agg(id))[1] into v_package_id from public.student_packages
      where user_id=v_uid and student_id=v_sched.student_id and status='active' having count(*)=1;
  end if;
  -- Lock the owning package before its schedules, as in the package editor.
  select * into v_pkg from public.student_packages
    where id=v_package_id and user_id=v_uid and student_id=v_sched.student_id for update;
  select * into v_sched from public.schedules where id=p_schedule_id and user_id=v_uid and status='scheduled'
    and package_id is not distinct from v_sched.package_id for update;
  if not found then
    raise exception 'Jadwal tidak ditemukan atau sudah selesai' using errcode = 'P0001';
  end if;

  insert into public.sessions
    (user_id, student_id, schedule_id, subject_id, session_date, started_at, ended_at,
     duration_minutes, material, sub_material, learning_notes, homework, score, progress_notes, status)
  values
    (v_uid, v_sched.student_id, p_schedule_id, v_sched.subject_id,
     (v_sched.start_at at time zone v_tz)::date, v_sched.start_at, v_sched.end_at,
     p_duration_minutes, p_material, p_sub_material, p_learning_notes, p_homework,
     p_score, p_progress_notes, 'completed')
  returning id into v_session_id;

  insert into public.attendance (user_id, session_id, student_id, status)
  values (v_uid, v_session_id, v_sched.student_id, p_attendance);

  select coalesce(s.deduct_package_policy, 'hadir_only') into v_policy
    from public.settings s where s.user_id = v_uid;

  v_policy:=coalesce(v_policy,'hadir_only');
  v_deduct :=
    (v_policy = 'hadir_only' and p_attendance = 'hadir')
    or (v_policy = 'include_izin_sakit' and p_attendance in ('hadir', 'izin', 'sakit'))
    or (v_policy = 'all_except_cancelled' and p_attendance in ('hadir', 'izin', 'sakit', 'alpha'));

  if v_deduct then
    if v_pkg.id is not null and v_pkg.status='active' then
      if v_pkg.sessions_used < v_pkg.total_sessions then
        update public.student_packages
          set sessions_used = sessions_used + 1
          where id = v_pkg.id;
        update public.sessions set deducted_package_id=v_pkg.id,package_deduction_recorded=true
          where id=v_session_id and user_id=v_uid;
      else
        insert into public.notifications (user_id, type, ref_key, title, body, link)
        values (v_uid, 'package_low', 'package_exhausted:' || v_pkg.id,
                'Paket habis',
                'Paket pertemuan siswa ini sudah habis. Buat paket baru agar pertemuan berikutnya tetap terhitung.',
                '/students/' || v_sched.student_id)
        on conflict (user_id, ref_key) do nothing;
      end if;
    end if;
  end if;

  update public.schedules set status = 'completed' where id = p_schedule_id;

  return v_session_id;
end;
$$;

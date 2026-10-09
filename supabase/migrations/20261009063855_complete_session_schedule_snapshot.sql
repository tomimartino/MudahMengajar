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

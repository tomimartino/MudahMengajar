-- Blank phone numbers do not identify a family. Keep real phone numbers unique.
alter table public.parents drop constraint parents_user_id_whatsapp_key;
create unique index parents_owner_phone_key on public.parents(user_id, whatsapp)
  where btrim(whatsapp) <> '';

alter table public.profiles add column profile_subjects text[];
comment on column public.profiles.profile_subjects is
  'Public portfolio selection; NULL preserves the legacy subject catalog.';

-- A fully cancelled package/invoice can legitimately have no remaining charge.
alter table public.student_packages drop constraint student_packages_total_sessions_check,
  drop constraint student_packages_price_check;
alter table public.student_packages add check (total_sessions >= 0), add check (price >= 0),
  add check (status = 'cancelled' or total_sessions > 0);
alter table public.invoices drop constraint invoices_amount_check;
alter table public.invoices add check (amount >= 0);

create function private.save_student_parent(p_name text, p_phone text, p_existing uuid default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Tidak terautentikasi.'; end if;
  if nullif(btrim(p_name),'') is null then return null; end if;
  p_phone := btrim(coalesce(p_phone,''));
  if p_phone <> '' then
    insert into public.parents(user_id,name,whatsapp) values(v_uid,btrim(p_name),p_phone)
      on conflict (user_id,whatsapp) where btrim(whatsapp) <> '' do update set name=excluded.name
      returning id into v_id;
  else
    -- Reuse only this student's unshared blank-phone record, never a sibling's record.
    if p_existing is not null then
      select id into v_id from public.parents p where p.id=p_existing and p.user_id=v_uid
        and btrim(p.whatsapp)='' and
        (select count(*) from public.students s where s.parent_id=p.id and s.user_id=v_uid)<=1
        for update;
    end if;
    if v_id is null then
      insert into public.parents(user_id,name,whatsapp) values(v_uid,btrim(p_name),'') returning id into v_id;
    else
      update public.parents set name=btrim(p_name) where id=v_id and user_id=v_uid;
    end if;
  end if;
  return v_id;
end;
$$;
revoke all on function private.save_student_parent(text,text,uuid) from public,anon;
grant execute on function private.save_student_parent(text,text,uuid) to authenticated;

-- Parent, student, subjects, invoice, package and schedules commit as one unit.
create function public.save_student_bundle(
  p_data jsonb, p_due_date date, p_period_label text, p_schedules jsonb,
  p_package_settings jsonb, p_student_id uuid default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_student_id uuid; v_parent_id uuid;
  v_billing jsonb; v_package_id uuid; v_subject_ids uuid[];
begin
  if v_uid is null or not private.app_accessible(v_uid) then
    raise exception 'Akun tidak dapat mengakses aplikasi.' using errcode='42501';
  end if;
  if jsonb_typeof(p_data) is distinct from 'object' or
    jsonb_typeof(p_data->'subject_ids') is distinct from 'array' or
    jsonb_typeof(p_schedules) is distinct from 'array' or p_due_date is null then
    raise exception 'Data murid atau jadwal tidak valid.';
  end if;
  select array_agg(distinct a.id::uuid) into v_subject_ids
    from jsonb_array_elements_text(p_data->'subject_ids') a(id);
  if coalesce(cardinality(v_subject_ids),0)=0 or exists(
    select 1 from unnest(v_subject_ids) a(id) where not exists(
      select 1 from public.subjects s where s.id=a.id and s.user_id=v_uid)) then
    raise exception 'Pilih mata pelajaran milik Anda.';
  end if;
  if p_student_id is null then
    v_parent_id:=private.save_student_parent(p_data->>'parent_name',p_data->>'parent_whatsapp');
    insert into public.students(user_id,parent_id,full_name,gender,birth_date,school_name,school_level,
      grade_level,phone,address,notes,learning_mode,billing_type,per_session_rate,monthly_fee,monthly_due_day,status)
    values(v_uid,v_parent_id,btrim(p_data->>'full_name'),nullif(p_data->>'gender',''),
      nullif(p_data->>'birth_date','')::date,nullif(btrim(p_data->>'school_name'),''),p_data->>'school_level',
      p_data->>'grade_level',nullif(btrim(p_data->>'phone'),''),nullif(btrim(p_data->>'address'),''),
      nullif(btrim(p_data->>'notes'),''),p_data->>'learning_mode',p_data->>'billing_type',
      (p_data->>'per_session_rate')::numeric,(p_data->>'monthly_fee')::numeric,
      (p_data->>'monthly_due_day')::int,p_data->>'status') returning id into v_student_id;
  else
    select id into v_student_id from public.students
      where id=p_student_id and user_id=v_uid and deleted_at is null for update;
    if not found then raise exception 'Siswa tidak ditemukan.'; end if;
    update public.students set learning_mode=p_data->>'learning_mode',billing_type=p_data->>'billing_type',
      per_session_rate=(p_data->>'per_session_rate')::numeric,monthly_fee=(p_data->>'monthly_fee')::numeric,
      monthly_due_day=(p_data->>'monthly_due_day')::int,status=p_data->>'status'
      where id=v_student_id and user_id=v_uid;
  end if;
  delete from public.student_subjects where student_id=v_student_id and user_id=v_uid;
  insert into public.student_subjects(user_id,student_id,subject_id)
    select v_uid,v_student_id,unnest(v_subject_ids);

  if p_data->>'billing_type'='package' then
    v_billing:=public.create_package(v_student_id,(p_data->>'package_sessions')::int,
      (p_data->>'package_price')::numeric,p_due_date,(p_data->>'package_per_session_rate')::numeric);
    v_package_id:=(v_billing->>'package_id')::uuid;
    update public.student_packages set form_settings=p_package_settings where id=v_package_id and user_id=v_uid;
  elsif p_data->>'billing_type'='monthly' then
    perform public.create_invoice(v_student_id,'monthly',p_period_label,(p_data->>'monthly_fee')::numeric,p_due_date);
  end if;
  if jsonb_array_length(p_schedules)>2000 or exists(
    select 1 from jsonb_to_recordset(p_schedules) as r(start_at timestamptz,end_at timestamptz)
      where r.start_at is null or r.end_at is null or r.end_at<=r.start_at) then
    raise exception 'Jadwal tidak valid.';
  end if;
  insert into public.schedules(user_id,student_id,package_id,subject_id,start_at,end_at,learning_mode,location,status)
    select v_uid,v_student_id,v_package_id,(p_data->'subject_ids'->>0)::uuid,r.start_at,r.end_at,
      p_data->>'learning_mode',nullif(btrim(p_data->>'schedule_location'),''),
      case when r.end_at<=now() then 'completed' else 'scheduled' end
    from jsonb_to_recordset(p_schedules) as r(start_at timestamptz,end_at timestamptz)
    where not exists(select 1 from public.schedules s where s.user_id=v_uid and s.student_id=v_student_id and s.start_at=r.start_at);
  return v_student_id;
end;
$$;
revoke all on function public.save_student_bundle(jsonb,date,text,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.save_student_bundle(jsonb,date,text,jsonb,jsonb,uuid) to authenticated;

create function public.update_student_identity(p_student_id uuid,p_data jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_parent_id uuid; v_student public.students;
begin
  select * into v_student from public.students
    where id=p_student_id and user_id=v_uid and deleted_at is null for update;
  if not found then raise exception 'Siswa tidak ditemukan.'; end if;
  v_parent_id:=private.save_student_parent(p_data->>'parent_name',p_data->>'parent_whatsapp',v_student.parent_id);
  update public.students set parent_id=v_parent_id,full_name=btrim(p_data->>'full_name'),
    gender=nullif(p_data->>'gender',''),birth_date=nullif(p_data->>'birth_date','')::date,
    school_name=nullif(btrim(p_data->>'school_name'),''),school_level=p_data->>'school_level',
    grade_level=p_data->>'grade_level',phone=nullif(btrim(p_data->>'phone'),''),
    address=nullif(btrim(p_data->>'address'),''),notes=nullif(btrim(p_data->>'notes'),'')
    where id=p_student_id and user_id=v_uid;
end;
$$;
revoke all on function public.update_student_identity(uuid,jsonb) from public,anon;
grant execute on function public.update_student_identity(uuid,jsonb) to authenticated;

create or replace function public.cancel_schedule(p_schedule_id uuid,p_reduce_price boolean default false)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_sched public.schedules; v_package_id uuid;
  v_pkg public.student_packages; v_invoice public.invoices;
  v_paid numeric; v_price numeric; v_total int;
begin
  select * into v_sched from public.schedules where id=p_schedule_id and user_id=v_uid and status='scheduled';
  if not found then raise exception 'Jadwal tidak ditemukan atau sudah dibatalkan.'; end if;
  v_package_id:=v_sched.package_id;
  if v_package_id is null then
    -- Unlinked legacy/manual schedules are deductible only with one unambiguous package.
    select (array_agg(id))[1] into v_package_id from public.student_packages
      where user_id=v_uid and student_id=v_sched.student_id and status='active' having count(*)=1;
  end if;
  -- Match the package editor's lock order: package, invoice, schedule.
  select * into v_pkg from public.student_packages where id=v_package_id and user_id=v_uid for update;
  select * into v_invoice from public.invoices where id=v_pkg.invoice_id and user_id=v_uid for update;
  select * into v_sched from public.schedules where id=p_schedule_id and user_id=v_uid and status='scheduled'
    and package_id is not distinct from v_sched.package_id for update;
  if not found then raise exception 'Jadwal sudah berubah. Muat ulang halaman.'; end if;
  if p_reduce_price and v_pkg.id is not null and v_pkg.status='active' and v_pkg.per_session_rate>0 then
    v_total:=greatest(v_pkg.total_sessions-1,v_pkg.sessions_used);
    v_price:=greatest(v_pkg.price-v_pkg.per_session_rate,0);
    select coalesce(sum(amount),0) into v_paid from public.payments where invoice_id=v_invoice.id and user_id=v_uid;
    if v_paid>v_price then raise exception 'Pembatalan melebihi sisa tagihan. Sesuaikan pembayaran terlebih dahulu.'; end if;
    update public.student_packages set total_sessions=v_total,price=v_price,
      status=case when v_total=0 then 'cancelled' when v_total=sessions_used then 'completed' else 'active' end
      where id=v_pkg.id and user_id=v_uid;
    update public.invoices set amount=v_price,period_label='Paket '||v_total||'x Pertemuan',
      status=case when v_paid>=v_price then 'paid' when v_paid>0 then 'partial' else 'unpaid' end
      where id=v_invoice.id and user_id=v_uid;
  end if;
  update public.schedules set status='cancelled' where id=p_schedule_id and user_id=v_uid;
end;
$$;
revoke all on function public.cancel_schedule(uuid,boolean) from public,anon;
grant execute on function public.cancel_schedule(uuid,boolean) to authenticated;

create function public.cancel_learning_schedule(p_schedule_id uuid,p_note text default null)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform public.cancel_schedule(p_schedule_id,true);
  if nullif(btrim(p_note),'') is not null then
    update public.schedules set notes=btrim(p_note) where id=p_schedule_id and user_id=auth.uid();
  end if;
end;
$$;
revoke all on function public.cancel_learning_schedule(uuid,text) from public,anon;
grant execute on function public.cancel_learning_schedule(uuid,text) to authenticated;


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
  perform 1 from public.schedules where id=p_schedule_id and user_id=v_uid and status='scheduled'
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

create or replace function public.get_public_profile(p_ident text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_subjects jsonb;
  v_exp jsonb;
  v_ach jsonb;
begin
  select id, full_name, headline, bio, rate, career_start_year, address, whatsapp, avatar_url, learning_mode, profile_subjects
    into v_profile
    from public.profiles
    where id::text = lower(p_ident) or lower(slug) = lower(p_ident);
  if not found or not private.app_accessible(v_profile.id) then
    raise exception 'Profil tidak ditemukan' using errcode = 'P0001';
  end if;

  if v_profile.profile_subjects is not null then
    v_subjects:=to_jsonb(v_profile.profile_subjects);
  else
  select coalesce(jsonb_agg(name order by name), '[]'::jsonb)
    into v_subjects
    from public.subjects
    where user_id = v_profile.id;
  end if;

  select coalesce(jsonb_agg(
      jsonb_build_object(
        'institution', institution,
        'role', role,
        'start_year', start_year,
        'end_year', end_year,
        'description', description
      ) order by start_year desc), '[]'::jsonb)
    into v_exp
    from public.teaching_experiences
    where user_id = v_profile.id;

  select coalesce(jsonb_agg(
      jsonb_build_object(
        'title', title,
        'year', year,
        'description', description
      ) order by created_at desc), '[]'::jsonb)
    into v_ach
    from public.achievements
    where user_id = v_profile.id;

  return jsonb_build_object(
    'full_name', v_profile.full_name,
    'headline', v_profile.headline,
    'bio', v_profile.bio,
    'rate', v_profile.rate,
    'career_start_year', v_profile.career_start_year,
    'address', v_profile.address,
    'whatsapp', v_profile.whatsapp,
    'avatar_url', v_profile.avatar_url,
    'learning_mode', v_profile.learning_mode,
    'subjects', v_subjects,
    'experiences', v_exp,
    'achievements', v_ach
  );
end;
$$;

create or replace function public.get_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_today date;
  v_month_start date;
  v_month_end date;
  v_schedules_today bigint;
  v_active_students bigint;
  v_open_invoices bigint;
  v_month_income numeric;
  v_today_list jsonb;
  v_next_list jsonb;
  v_reminders jsonb;
begin
  if v_uid is null or not private.app_accessible(v_uid) then raise exception 'Akun tidak dapat mengakses aplikasi.' using errcode='42501'; end if;
  if v_uid is null then
    raise exception 'Tidak terautentikasi' using errcode = 'P0001';
  end if;

  select coalesce(timezone, 'Asia/Jakarta') into v_tz from public.profiles where id = v_uid;
  v_today := (now() at time zone v_tz)::date;
  v_month_start := date_trunc('month', now() at time zone v_tz)::date;
  v_month_end := (date_trunc('month', now() at time zone v_tz) + interval '1 month')::date;

  select count(*) into v_schedules_today from public.schedules s
    where s.user_id = v_uid and s.status = 'scheduled'
      and exists(select 1 from public.students a where a.id=s.student_id and a.user_id=v_uid and a.status='active' and a.deleted_at is null)
      and (s.start_at at time zone v_tz)::date = v_today;

  select count(*) into v_active_students from public.students
    where user_id = v_uid and status = 'active' and deleted_at is null;

  select count(*) into v_open_invoices from public.invoices
    where user_id = v_uid and status in ('unpaid', 'partial');

  select coalesce(sum(amount), 0) into v_month_income from public.payments
    where user_id = v_uid and payment_date >= v_month_start and payment_date < v_month_end;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_today_list from (
    select s.id, s.start_at, s.end_at, s.status, s.learning_mode, s.location,
           st.full_name as student_name, st.grade_level, st.school_level,
           sub.name as subject_name
      from public.schedules s
      join public.students st on st.id = s.student_id
      join public.subjects sub on sub.id = s.subject_id
      where s.user_id = v_uid and s.status = 'scheduled'
      and exists(select 1 from public.students a where a.id=s.student_id and a.user_id=v_uid and a.status='active' and a.deleted_at is null)
        and (s.start_at at time zone v_tz)::date = v_today
      order by s.start_at
  ) x;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_next_list from (
    select s.id, s.start_at, s.end_at, s.status, s.learning_mode,
           st.full_name as student_name, sub.name as subject_name
      from public.schedules s
      join public.students st on st.id = s.student_id
      join public.subjects sub on sub.id = s.subject_id
      where s.user_id = v_uid and s.status = 'scheduled'
      and exists(select 1 from public.students a where a.id=s.student_id and a.user_id=v_uid and a.status='active' and a.deleted_at is null)
        and (s.start_at at time zone v_tz)::date > v_today
      order by s.start_at
      limit 5
  ) x;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_reminders from (
    select id, type, title, body, link, read_at, created_at
      from public.notifications
      where user_id = v_uid and read_at is null
      order by created_at desc
      limit 6
  ) x;

  return jsonb_build_object(
    'schedules_today', v_schedules_today,
    'active_students', v_active_students,
    'open_invoices', v_open_invoices,
    'month_income', v_month_income,
    'today_schedules', v_today_list,
    'next_schedules', v_next_list,
    'reminders', v_reminders
  );
end;
$$;
revoke all on function public.complete_session(uuid,text,int,text,text,text,text,numeric,text) from public,anon;
grant execute on function public.complete_session(uuid,text,int,text,text,text,text,numeric,text) to authenticated;
notify pgrst, 'reload schema';

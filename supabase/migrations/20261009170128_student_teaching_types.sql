-- One group occupies one existing learner record, package, invoice, and schedule.
-- Existing learners remain private; no customer records or bills are converted.
alter table public.students
  add column teaching_type text not null default 'private',
  add column group_size integer,
  add constraint students_teaching_type_check check (teaching_type in ('private','group')),
  add constraint students_group_size_check check (
    (teaching_type='private' and group_size is null) or
    (teaching_type='group' and group_size is not null and group_size between 2 and 1000)
  );

-- Per-session billing has no invoice due date; retain required dates for packages/monthly bills.
create or replace function public.save_student_bundle(
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
    jsonb_typeof(p_schedules) is distinct from 'array' then
    raise exception 'Data murid atau jadwal tidak valid.';
  end if;
  if p_data->>'billing_type' in ('package','monthly') and p_due_date is null then
    raise exception 'Tanggal jatuh tempo wajib diisi.';
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
      grade_level,phone,address,notes,learning_mode,billing_type,per_session_rate,monthly_fee,monthly_due_day,status,teaching_type,group_size)
    values(v_uid,v_parent_id,btrim(p_data->>'full_name'),nullif(p_data->>'gender',''),
      nullif(p_data->>'birth_date','')::date,nullif(btrim(p_data->>'school_name'),''),p_data->>'school_level',
      p_data->>'grade_level',nullif(btrim(p_data->>'phone'),''),nullif(btrim(p_data->>'address'),''),
      nullif(btrim(p_data->>'notes'),''),p_data->>'learning_mode',p_data->>'billing_type',
      (p_data->>'per_session_rate')::numeric,(p_data->>'monthly_fee')::numeric,
      (p_data->>'monthly_due_day')::int,p_data->>'status',coalesce(p_data->>'teaching_type','private'),
      case when p_data->>'teaching_type'='group' then (p_data->>'group_size')::int end) returning id into v_student_id;
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

create or replace function public.update_student_identity(p_student_id uuid,p_data jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_parent_id uuid; v_student public.students;
begin
  if v_uid is null or not private.app_accessible(v_uid) then
    raise exception 'Akun tidak dapat mengakses aplikasi.' using errcode='42501';
  end if;
  select * into v_student from public.students
    where id=p_student_id and user_id=v_uid and deleted_at is null for update;
  if not found then raise exception 'Siswa tidak ditemukan.'; end if;
  -- Identity edits may resize a group but must not change its billing identity.
  if coalesce(p_data->>'teaching_type',v_student.teaching_type)<>v_student.teaching_type then
    raise exception 'Jenis belajar tidak dapat diubah melalui edit identitas.';
  end if;
  v_parent_id:=private.save_student_parent(p_data->>'parent_name',p_data->>'parent_whatsapp',v_student.parent_id);
  update public.students set parent_id=v_parent_id,full_name=btrim(p_data->>'full_name'),
    gender=nullif(p_data->>'gender',''),birth_date=nullif(p_data->>'birth_date','')::date,
    school_name=nullif(btrim(p_data->>'school_name'),''),school_level=p_data->>'school_level',
    grade_level=p_data->>'grade_level',phone=nullif(btrim(p_data->>'phone'),''),
    address=nullif(btrim(p_data->>'address'),''),notes=nullif(btrim(p_data->>'notes'),''),
    group_size=case when v_student.teaching_type='group' then
      case when p_data ? 'group_size' then (p_data->>'group_size')::int else v_student.group_size end end
    where id=p_student_id and user_id=v_uid;
end;
$$;
revoke all on function public.save_student_bundle(jsonb,date,text,jsonb,jsonb,uuid),
  public.update_student_identity(uuid,jsonb) from public,anon;
grant execute on function public.save_student_bundle(jsonb,date,text,jsonb,jsonb,uuid),
  public.update_student_identity(uuid,jsonb) to authenticated;

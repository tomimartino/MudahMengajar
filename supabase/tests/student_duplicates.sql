-- Duplicate-name guard, teacher isolation and legacy records; no fixtures survive.
begin;
do $$
declare
  u uuid := gen_random_uuid(); other_u uuid := gen_random_uuid();
  student uuid := gen_random_uuid(); other_student uuid := gen_random_uuid();
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (u,u::text||'@example.invalid','{}'),(other_u,other_u::text||'@example.invalid','{}');
  insert into public.students(id,user_id,full_name,school_level,grade_level) values
    (student,u,'Nama Murid QA','SD','4'),(other_student,u,'Nama Berbeda QA','SD','4');
  -- Case, leading/trailing whitespace, repeated spaces and tabs cannot evade the guard.
  begin
    insert into public.students(user_id,full_name,school_level,grade_level)
      values(u,E'  nAMA \t MURID   QA  ','SMP','7');
    raise exception 'Duplicate insert accepted';
  exception when unique_violation then null; end;
  begin
    update public.students set full_name='NAMA MURID QA' where id=other_student;
    raise exception 'Duplicate rename accepted';
  exception when unique_violation then null; end;
  update public.students set status='inactive' where id=student;
  begin
    insert into public.students(user_id,full_name,school_level,grade_level)
      values(u,'Nama Murid QA','SD','4');
    raise exception 'Inactive duplicate accepted';
  exception when unique_violation then null; end;
  -- Same names in a different teacher's account are allowed.
  insert into public.students(user_id,full_name,school_level,grade_level)
    values(other_u,'Nama Murid QA','SD','4');
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('role','authenticated',true);
  if not public.student_name_conflicts(' NAMA   MURID QA ') then raise exception 'Preflight missed duplicate'; end if;
  if public.student_name_conflicts('Nama Baru QA') then raise exception 'Preflight rejected a new name'; end if;
  if public.student_name_conflicts('Nama Murid QA',student) then raise exception 'Unchanged name rejected'; end if;
  if not public.student_name_conflicts('Nama Murid QA',other_student) then raise exception 'Duplicate rename missed'; end if;
  if has_function_privilege('anon','public.student_name_conflicts(text,uuid)','execute') then raise exception 'Anonymous lookup exposed'; end if;
  perform set_config('request.jwt.claim.sub',other_u::text,true);
  if public.student_name_conflicts('Nama Berbeda QA') then raise exception 'Preflight exposed another teacher'; end if;
  perform set_config('role','postgres',true);
  -- Soft-deleted names may be reused; restoring into a conflict must fail.
  update public.students set deleted_at=now() where id=student;
  insert into public.students(user_id,full_name,school_level,grade_level)
    values(u,'Nama Murid QA','SD','4');
  begin
    update public.students set deleted_at=null where id=student;
    raise exception 'Conflicting restore accepted';
  exception when unique_violation then null; end;
  -- Simulate old duplicates to prove migration leaves them usable without accepting new ones.
  alter table public.students disable trigger prevent_duplicate_student_name;
  insert into public.students(user_id,full_name,school_level,grade_level)
    values(u,'Nama Berbeda QA','SD','4');
  alter table public.students enable trigger prevent_duplicate_student_name;
  update public.students set full_name=' nama  berbeda qa ',notes='Legacy edit' where id=other_student;
  begin
    insert into public.students(user_id,full_name,school_level,grade_level)
      values(u,'Nama Berbeda QA','SD','4');
    raise exception 'New legacy-name duplicate accepted';
  exception when unique_violation then null; end;
end $$;
rollback;
select 'PASS: duplicate prevention, case/spacing, edits, inactive students, teacher isolation and legacy data' as result;

alter table public.sessions add column homework_due_date date;
create table public.learning_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check(char_length(trim(title)) between 1 and 200),
  content text not null default '' check(char_length(content)<=10000),
  source_session_id uuid references public.sessions(id) on delete set null,
  files jsonb not null default '[]' check(jsonb_typeof(files)='array' and jsonb_array_length(files)<=5),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index learning_materials_owner_idx on public.learning_materials(user_id,created_at desc);
create index learning_materials_session_idx on public.learning_materials(source_session_id);
create table public.homework_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  session_id uuid unique references public.sessions(id) on delete cascade,
  title text not null check(char_length(trim(title)) between 1 and 200),
  description text not null default '' check(char_length(description)<=10000),
  due_date date,
  status text not null default 'assigned' check(status in ('assigned','completed')),
  completed_at timestamptz,
  files jsonb not null default '[]' check(jsonb_typeof(files)='array' and jsonb_array_length(files)<=5),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index homework_tasks_owner_idx on public.homework_tasks(user_id,status,due_date,created_at desc);
create index homework_tasks_student_idx on public.homework_tasks(student_id);
alter table public.learning_materials enable row level security;
alter table public.homework_tasks enable row level security;
grant select,insert,update,delete on public.learning_materials,public.homework_tasks to authenticated;
grant all on public.learning_materials,public.homework_tasks to service_role;
revoke all on public.learning_materials,public.homework_tasks from anon;
create policy material_owner on public.learning_materials for all to authenticated
  using(user_id=(select auth.uid()) and (select private.app_accessible(auth.uid())))
  with check(user_id=(select auth.uid()) and (select private.app_accessible(auth.uid())));
create policy homework_owner on public.homework_tasks for all to authenticated
  using(user_id=(select auth.uid()) and (select private.app_accessible(auth.uid())))
  with check(user_id=(select auth.uid()) and (select private.app_accessible(auth.uid())));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('teaching-files','teaching-files',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation']);
create policy teaching_file_read on storage.objects for select to authenticated
  using(bucket_id='teaching-files' and (storage.foldername(name))[1]=(select auth.uid())::text and (select private.app_accessible(auth.uid())));
create policy teaching_file_insert on storage.objects for insert to authenticated
  with check(bucket_id='teaching-files' and (storage.foldername(name))[1]=(select auth.uid())::text and (select private.app_accessible(auth.uid())));
create policy teaching_file_delete on storage.objects for delete to authenticated
  using(bucket_id='teaching-files' and (storage.foldername(name))[1]=(select auth.uid())::text and (select private.app_accessible(auth.uid())));

-- Validate parent ownership and each private attachment at the database boundary.
create function private.validate_learning_resource() returns trigger
language plpgsql security definer set search_path='' as $$
declare f jsonb; v_session uuid; begin
  if tg_op='UPDATE' and new.user_id<>old.user_id then raise exception 'Pemilik tidak dapat diubah.' using errcode='42501'; end if;
  if tg_table_name='homework_tasks' then
    if not exists(select 1 from public.students where id=new.student_id and user_id=new.user_id and deleted_at is null) then raise exception 'Murid tidak ditemukan.'; end if;
    v_session:=new.session_id;
    if v_session is not null and not exists(select 1 from public.sessions where id=v_session and user_id=new.user_id and student_id=new.student_id) then raise exception 'Pertemuan tidak ditemukan.'; end if;
    if tg_op='UPDATE' and new.session_id is distinct from old.session_id then raise exception 'Pertemuan asal tidak dapat diubah.'; end if;
    new.completed_at:=case when new.status='completed' then coalesce(new.completed_at,now()) else null end;
  else
    v_session:=new.source_session_id;
    if v_session is not null and not exists(select 1 from public.sessions where id=v_session and user_id=new.user_id) then raise exception 'Pertemuan tidak ditemukan.'; end if;
  end if;
  if jsonb_typeof(new.files)<>'array' or jsonb_array_length(new.files)>5 then raise exception 'Lampiran tidak valid.'; end if;
  for f in select * from jsonb_array_elements(new.files) loop
    if jsonb_typeof(f)<>'object' or coalesce(f->>'name','')='' or char_length(f->>'name')>255
      or coalesce((f->>'size')::bigint,0) not between 1 and 10485760
      or split_part(coalesce(f->>'path',''), '/',1)<>new.user_id::text
      or not exists(select 1 from storage.objects where bucket_id='teaching-files' and name=f->>'path') then
      raise exception 'Lampiran tidak valid.' using errcode='42501';
    end if;
  end loop;
  new.updated_at:=now(); return new;
end $$;
revoke all on function private.validate_learning_resource() from public,anon,authenticated;
create trigger validate_learning_material before insert or update on public.learning_materials for each row execute function private.validate_learning_resource();
create trigger validate_homework_task before insert or update on public.homework_tasks for each row execute function private.validate_learning_resource();

create function private.sync_session_homework() returns trigger
language plpgsql security definer set search_path='' as $$ begin
  if pg_trigger_depth()>1 then return new; end if;
  if nullif(trim(new.homework),'') is not null then
    insert into public.homework_tasks(user_id,student_id,session_id,title,description,due_date)
      values(new.user_id,new.student_id,new.id,left(trim(new.homework),200),new.homework,new.homework_due_date)
      on conflict(session_id) do update set title=excluded.title,description=excluded.description,due_date=excluded.due_date,updated_at=now();
  else delete from public.homework_tasks where session_id=new.id; end if;
  return new;
end $$;
create function private.sync_homework_session() returns trigger
language plpgsql security definer set search_path='' as $$ begin
  if pg_trigger_depth()>1 then return new; end if;
  if tg_op='DELETE' then
    update public.sessions set homework=null,homework_due_date=null where id=old.session_id and user_id=old.user_id;
    return old;
  end if;
  if new.session_id is not null then
    update public.sessions set homework=coalesce(nullif(new.description,''),new.title),homework_due_date=new.due_date where id=new.session_id and user_id=new.user_id
      and (homework,homework_due_date) is distinct from (coalesce(nullif(new.description,''),new.title),new.due_date);
  end if;
  return new;
end $$;
revoke all on function private.sync_session_homework(),private.sync_homework_session() from public,anon,authenticated;
create trigger session_homework_sync after insert or update of homework,homework_due_date on public.sessions for each row execute function private.sync_session_homework();
create trigger homework_session_sync after insert or update or delete on public.homework_tasks for each row execute function private.sync_homework_session();
insert into public.homework_tasks(user_id,student_id,session_id,title,description)
  select user_id,student_id,id,left(trim(homework),200),homework from public.sessions where nullif(trim(homework),'') is not null;

create function public.complete_learning_session(p_schedule_id uuid,p_attendance text,p_duration_minutes integer,
  p_material text,p_sub_material text,p_learning_notes text,p_homework text,p_score numeric,p_progress_notes text,p_homework_due_date date default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid; begin
  if auth.uid() is null or not private.app_accessible(auth.uid()) then raise exception 'Akun tidak dapat mengakses aplikasi.' using errcode='42501'; end if;
  if p_homework_due_date is not null and nullif(trim(p_homework),'') is null then raise exception 'Isi PR sebelum menentukan tenggat.'; end if;
  v_id:=public.complete_session(p_schedule_id,p_attendance,p_duration_minutes,p_material,p_sub_material,p_learning_notes,p_homework,p_score,p_progress_notes);
  update public.sessions set homework_due_date=p_homework_due_date where id=v_id and user_id=auth.uid();
  return v_id;
end $$;
revoke all on function public.complete_learning_session(uuid,text,integer,text,text,text,text,numeric,text,date) from public,anon;
grant execute on function public.complete_learning_session(uuid,text,integer,text,text,text,text,numeric,text,date) to authenticated;

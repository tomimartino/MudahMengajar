-- Remove self-booking. Existing schedules remain ordinary teacher-managed schedules.
drop function public.portal_book_slot(text,uuid,uuid);

create or replace function private.check_schedule_conflict() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status='scheduled' and (tg_op='INSERT' or new.start_at is distinct from old.start_at
    or new.end_at is distinct from old.end_at or new.status is distinct from old.status) then
    perform pg_advisory_xact_lock(hashtextextended('schedule:'||new.user_id::text,0));
    if exists(select 1 from public.schedules s where s.user_id=new.user_id and s.id<>new.id
      and s.status='scheduled' and s.start_at<new.end_at and s.end_at>new.start_at) then
      raise exception 'Jadwal bentrok dengan pertemuan lain' using errcode='P0001';
    end if;
  end if;
  return new;
end $$;

create or replace function private.validate_learning_owner() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.students where id=new.student_id and user_id=new.user_id and deleted_at is null) then
    raise exception 'Murid tidak tersedia' using errcode='P0001';
  end if;
  if tg_table_name='assignments' then
    if new.session_id is not null and not exists(
      select 1 from public.sessions where id=new.session_id and user_id=new.user_id and student_id=new.student_id
    ) then raise exception 'Pertemuan tidak sesuai murid' using errcode='P0001'; end if;
  elsif tg_table_name='homework_submissions' then
    if not exists(
      select 1 from public.assignments where id=new.assignment_id and user_id=new.user_id and student_id=new.student_id
    ) then raise exception 'Tugas tidak sesuai murid' using errcode='P0001'; end if;
  end if;
  new.updated_at=now();
  return new;
end $$;

drop table public.booking_slots;
delete from public.notifications where ref_key like 'booking:%';
delete from public.audit_logs where table_name='booking_slots';

-- A session's PR has no deadline until one is explicitly provided by the teacher.
alter table public.assignments alter column due_at drop not null;
alter table public.assignments add column from_session boolean not null default false;
alter table public.assignments drop constraint assignments_description_check;
alter table public.assignments add constraint assignments_description_check
  check(char_length(btrim(description)) >= 1);
create unique index assignments_one_session_pr on public.assignments(session_id) where from_session;

-- Reuse a matching previously published task instead of duplicating it during backfill.
update public.assignments a set from_session=true
from public.sessions s
where a.session_id=s.id and a.user_id=s.user_id and a.student_id=s.student_id
  and s.status='completed' and nullif(btrim(s.homework),'') is not null
  and a.id=(select x.id from public.assignments x where x.session_id=s.id
    and x.user_id=s.user_id and x.student_id=s.student_id and x.description=btrim(s.homework)
    order by x.created_at,x.id limit 1);

create or replace function private.sync_session_assignment(p_session_id uuid,p_republish boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare
  s public.sessions; a public.assignments; content text; task_title text; task_id uuid;
begin
  select * into s from public.sessions where id=p_session_id;
  if not found then return; end if;
  if not exists(select 1 from public.students where id=s.student_id and user_id=s.user_id and deleted_at is null) then return; end if;
  select * into a from public.assignments
    where session_id=s.id and from_session and user_id=s.user_id and student_id=s.student_id for update;
  content=nullif(btrim(s.homework),'');
  if s.status<>'completed' or content is null then
    if a.id is not null and a.status<>'closed' then
      update public.assignments set status='closed' where id=a.id;
    end if;
    return;
  end if;
  select 'PR · '||left(coalesce(name,'Pertemuan'),85)||' · '||to_char(s.session_date,'DD/MM/YYYY')
    into task_title from public.subjects where id=s.subject_id and user_id=s.user_id;
  task_title=coalesce(task_title,'PR · Pertemuan · '||to_char(s.session_date,'DD/MM/YYYY'));
  insert into public.assignments(user_id,student_id,session_id,title,description,from_session)
    values(s.user_id,s.student_id,s.id,task_title,content,true)
    on conflict(session_id) where from_session do update
      set title=excluded.title,description=excluded.description,
        status=case when p_republish then 'published' else assignments.status end
      where assignments.title is distinct from excluded.title
        or assignments.description is distinct from excluded.description
        or (p_republish and assignments.status<>'published')
    returning id into task_id;
  if a.id is not null and a.description is distinct from content then
    update public.homework_submissions set status='revision_requested',score=null,reviewed_at=null
      where assignment_id=a.id;
  end if;
end $$;

create or replace function private.session_assignment_trigger() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform private.sync_session_assignment(new.id,
    tg_op='INSERT' or new.homework is distinct from old.homework or new.status is distinct from old.status);
  return new;
end $$;
create trigger session_assignment_sync after insert or update of homework,status,session_date,subject_id
  on public.sessions for each row execute function private.session_assignment_trigger();

revoke all on function private.sync_session_assignment(uuid,boolean),private.session_assignment_trigger() from public,anon,authenticated;
revoke all on function private.validate_learning_owner(),private.check_schedule_conflict() from public,anon,authenticated;

do $$ declare session_id uuid; begin
  for session_id in select s.id from public.sessions s
    join public.students st on st.id=s.student_id and st.user_id=s.user_id and st.deleted_at is null
    where s.status='completed' and nullif(btrim(s.homework),'') is not null
  loop
    perform private.sync_session_assignment(session_id);
  end loop;
end $$;

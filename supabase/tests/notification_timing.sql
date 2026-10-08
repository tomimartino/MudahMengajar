-- Deterministic boundary tests; no notifications or fixtures survive the rollback.
begin;
do $$
declare
  u uuid=gen_random_uuid(); other_u uuid=gen_random_uuid();
  student uuid=gen_random_uuid(); other_student uuid=gen_random_uuid();
  subject uuid=gen_random_uuid(); upcoming uuid=gen_random_uuid(); previous uuid=gen_random_uuid();
  start_time timestamptz='2026-10-09 10:00:00+07';
  notif_id uuid; read_time timestamptz; created_time timestamptz; old_keys text[];
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (u,u::text||'@example.invalid','{}'),(other_u,other_u::text||'@example.invalid','{}');
  update public.profiles set timezone='Asia/Jakarta' where id=u;
  update public.profiles set timezone='America/Los_Angeles' where id=other_u;
  update public.settings set notify_schedule=true,notify_material=true,notify_payment=false,notify_package=false
    where user_id in (u,other_u);
  insert into public.students(id,user_id,full_name,school_level,grade_level) values
    (student,u,'Siswa timing','SD','4'),(other_student,other_u,'Siswa zona lain','SD','4');
  insert into public.subjects(id,user_id,name) values(subject,u,'Matematika');
  insert into public.sessions(id,user_id,student_id,subject_id,session_date,started_at,ended_at,material,homework)
    values(previous,u,student,subject,'2026-10-07','2026-10-07 09:00+07','2026-10-07 10:00+07','Pecahan','Soal 1-5');
  insert into public.schedules(id,user_id,student_id,subject_id,start_at,end_at)
    values(upcoming,u,student,subject,start_time,start_time+interval '1 hour');

  perform private.refresh_schedule_reminders(u,'2026-10-08 23:59:59+07');
  if exists(select 1 from public.notifications where user_id=u) then raise exception 'Daily reminder before midnight'; end if;
  perform private.refresh_schedule_reminders(u,'2026-10-09 00:00:00+07');
  if (select count(*) from public.notifications where user_id=u and type='schedule_today')<>1 then raise exception 'Missing midnight reminder'; end if;
  select id,created_at into notif_id,created_time from public.notifications where user_id=u and type='schedule_today';
  perform private.refresh_schedule_reminders(u,'2026-10-09 00:01:00+07');
  if not exists(select 1 from public.notifications where id=notif_id and created_at=created_time and read_at is null)
    then raise exception 'Unread reminder was recreated'; end if;
  update public.notifications set read_at=now() where id=notif_id returning read_at into read_time;
  perform private.refresh_schedule_reminders(u,start_time-interval '1 hour 1 second');
  if exists(select 1 from public.notifications where user_id=u and type='schedule_soon') then raise exception 'Hourly reminder too early'; end if;
  perform private.refresh_schedule_reminders(u,start_time-interval '1 hour');
  if (select count(*) from public.notifications where user_id=u and type in ('schedule_today','schedule_soon'))<>2 then raise exception 'Expected two schedule reminders'; end if;
  if not exists(select 1 from public.notifications where id=notif_id and read_at=read_time and created_at=created_time)
    then raise exception 'Read state was reset'; end if;
  perform private.refresh_material_reminders(u,start_time-interval '5 minutes 1 second');
  if exists(select 1 from public.notifications where user_id=u and type='material_review') then raise exception 'Material reminder too early'; end if;
  perform private.refresh_material_reminders(u,start_time-interval '5 minutes');
  if (select count(*) from public.notifications where user_id=u)<>3 then raise exception 'Material not separated from schedule'; end if;
  if not exists(select 1 from public.notifications where user_id=u and type='material_review'
    and body like '%Pecahan%' and body like '%Soal 1-5%' and link='/sessions/'||previous)
    then raise exception 'Wrong material reminder content'; end if;
  select array_agg(ref_key) into old_keys from public.notifications where user_id=u;
  insert into public.push_log(user_id,ref_key) select user_id,ref_key from public.notifications where user_id=u;
  perform private.refresh_schedule_reminders(u,start_time-interval '4 minutes');
  perform private.refresh_material_reminders(u,start_time-interval '4 minutes');
  if (select count(*) from public.notifications where user_id=u)<>3 or (select count(*) from public.push_log where user_id=u)<>3
    then raise exception 'Repeated refresh duplicated reminder or discarded sent state'; end if;

  update public.settings set notify_schedule=false where user_id=u;
  perform private.refresh_schedule_reminders(u,start_time-interval '4 minutes');
  perform private.refresh_material_reminders(u,start_time-interval '4 minutes');
  if (select count(*) from public.notifications where user_id=u)<>1 then raise exception 'Schedule toggle disabled material too'; end if;
  update public.settings set notify_schedule=true,notify_material=false where user_id=u;
  perform private.refresh_schedule_reminders(u,start_time-interval '4 minutes');
  perform private.refresh_material_reminders(u,start_time-interval '4 minutes');
  if (select count(*) from public.notifications where user_id=u)<>2 then raise exception 'Material toggle disabled schedule too'; end if;
  update public.settings set notify_material=true where user_id=u;
  update public.schedules set start_at=start_time+interval '2 hours',end_at=start_time+interval '3 hours' where id=upcoming;
  perform private.refresh_schedule_reminders(u,start_time-interval '4 minutes');
  perform private.refresh_material_reminders(u,start_time-interval '4 minutes');
  if (select count(*) from public.notifications where user_id=u)<>1
    or exists(select 1 from public.notifications where user_id=u and ref_key=any(old_keys)) then raise exception 'Moved schedule retained old reminders'; end if;
  update public.schedules set status='cancelled' where id=upcoming;
  perform private.refresh_schedule_reminders(u,start_time-interval '4 minutes');
  perform private.refresh_material_reminders(u,start_time-interval '4 minutes');
  if exists(select 1 from public.notifications where user_id=u) then raise exception 'Cancelled schedule reminders remained'; end if;
  update public.schedules set status='scheduled',start_at=start_time,end_at=start_time+interval '1 hour' where id=upcoming;
  perform private.refresh_schedule_reminders(u,start_time);
  perform private.refresh_material_reminders(u,start_time);
  if exists(select 1 from public.notifications where user_id=u) then raise exception 'Started schedule generated reminders'; end if;
  update public.students set status='inactive' where id=student;
  perform private.refresh_schedule_reminders(u,start_time-interval '4 minutes');
  perform private.refresh_material_reminders(u,start_time-interval '4 minutes');
  if exists(select 1 from public.notifications where user_id=u) then raise exception 'Inactive student generated reminders'; end if;
  update public.students set status='active' where id=student;

  -- The hour-before event can precede local midnight for an early morning lesson.
  update public.schedules set start_at='2026-10-09 00:30+07',end_at='2026-10-09 01:30+07' where id=upcoming;
  perform private.refresh_schedule_reminders(u,'2026-10-08 23:30+07');
  if (select count(*) from public.notifications where user_id=u and type='schedule_soon')<>1
    or exists(select 1 from public.notifications where user_id=u and type='schedule_today') then raise exception 'Cross-midnight hourly reminder failed'; end if;
  perform private.refresh_schedule_reminders(u,'2026-10-09 00:00+07');
  if (select count(*) from public.notifications where user_id=u)<>2 then raise exception 'Cross-midnight daily reminder failed'; end if;

  insert into public.subjects(user_id,name) values(other_u,'Bahasa') returning id into subject;
  insert into public.schedules(user_id,student_id,subject_id,start_at,end_at)
    values(other_u,other_student,subject,'2026-10-09 10:00-07','2026-10-09 11:00-07');
  perform private.refresh_schedule_reminders(other_u,'2026-10-08 23:59:59-07');
  if exists(select 1 from public.notifications where user_id=other_u) then raise exception 'Used server timezone for midnight'; end if;
  perform private.refresh_schedule_reminders(other_u,'2026-10-09 00:00-07');
  if (select count(*) from public.notifications where user_id=other_u)<>1 then raise exception 'User timezone midnight failed'; end if;
  perform private.refresh_material_reminders(other_u,'2026-10-09 09:55-07');
  if exists(select 1 from public.notifications where user_id=other_u and type='material_review') then raise exception 'First lesson borrowed another teacher material'; end if;
  if has_function_privilege('authenticated','private.refresh_schedule_reminders(uuid,timestamptz)','execute')
    or has_function_privilege('anon','private.refresh_material_reminders(uuid,timestamptz)','execute') then
    raise exception 'Private reminder helper exposed';
  end if;
end $$;
rollback;
select 'PASS: midnight, hour and five-minute boundaries, separate toggles, deduplication, changes and timezones' as result;

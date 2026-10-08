-- Exercise the RPC under authenticated RLS; every fixture and grant change rolls back.
begin;
do $$
declare
  u uuid := gen_random_uuid(); other_u uuid := gen_random_uuid();
  student uuid := gen_random_uuid(); subject uuid := gen_random_uuid();
  completed uuid := gen_random_uuid(); historical uuid := gen_random_uuid();
  upcoming uuid := gen_random_uuid(); cancelled uuid := gen_random_uuid();
  lesson uuid := gen_random_uuid(); invoice uuid := gen_random_uuid();
  before_lesson jsonb; before_schedule jsonb; before_money jsonb; after_money jsonb;
  original_time timestamptz := '2026-09-07 14:00+07';
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (u,u::text||'@example.invalid','{}'),(other_u,other_u::text||'@example.invalid','{}');
  update public.profiles set timezone='Asia/Jakarta' where id=u;
  insert into public.students(id,user_id,full_name,school_level,grade_level)
    values(student,u,'Koreksi Pertemuan QA','SD','4');
  insert into public.subjects(id,user_id,name) values(subject,u,'Matematika QA');
  insert into public.invoices(id,user_id,student_id,invoice_number,type,amount,due_date,status)
    values(invoice,u,student,'QA-OLD-PACKAGE','package',400000,'2026-09-30','partial');
  insert into public.student_packages(user_id,student_id,invoice_id,total_sessions,sessions_used,price,start_date,status,created_at)
    values(u,student,invoice,8,8,400000,'2026-09-01','completed','2026-09-01'),
          (u,student,null,8,2,400000,'2026-10-01','active','2026-10-01');
  insert into public.payments(user_id,student_id,invoice_id,type,amount,payment_date,method)
    values(u,student,invoice,'package',200000,'2026-09-03','cash');
  insert into public.schedules(id,user_id,student_id,subject_id,start_at,end_at,status,notes,recurrence_rule)
    values(completed,u,student,subject,original_time,original_time+interval '90 minutes','completed','Catatan jadwal','{"days":[1]}'),
          (historical,u,student,subject,'2026-09-14 14:00+07','2026-09-14 15:30+07','completed',null,null),
          (upcoming,u,student,subject,'2026-10-12 14:00+07','2026-10-12 15:30+07','scheduled',null,null),
          (cancelled,u,student,subject,'2026-09-21 14:00+07','2026-09-21 15:30+07','cancelled',null,null);
  insert into public.sessions(id,user_id,student_id,schedule_id,subject_id,session_date,started_at,ended_at,
    duration_minutes,material,sub_material,learning_notes,homework,score,progress_notes)
    values(lesson,u,student,completed,subject,'2026-09-07',original_time+interval '5 minutes',
      original_time+interval '85 minutes',80,'Pecahan','Penjumlahan','Catatan belajar','Soal 1-5',90,'Meningkat');
  insert into public.attendance(user_id,student_id,session_id,status,note)
    values(u,student,lesson,'hadir','Tepat waktu');

  select to_jsonb(s)-array['session_date','started_at','ended_at','updated_at'] into before_lesson
    from public.sessions s where id=lesson;
  select to_jsonb(s)-array['start_at','end_at','updated_at'] into before_schedule
    from public.schedules s where id=completed;
  select jsonb_build_object(
    'packages',(select jsonb_agg(to_jsonb(p) order by p.id) from public.student_packages p where user_id=u),
    'invoices',(select jsonb_agg(to_jsonb(i) order by i.id) from public.invoices i where user_id=u),
    'payments',(select jsonb_agg(to_jsonb(p) order by p.id) from public.payments p where user_id=u),
    'attendance',(select jsonb_agg(to_jsonb(a) order by a.id) from public.attendance a where user_id=u)
  ) into before_money;

  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('role','authenticated',true);
  perform public.move_schedule(completed,'2026-09-08','16:00');
  if not exists(select 1 from public.schedules where id=completed and status='completed'
    and start_at='2026-09-08 16:00+07' and end_at='2026-09-08 17:30+07') then
    raise exception 'Completed schedule date, status or duration incorrect';
  end if;
  if not exists(select 1 from public.sessions where id=lesson and schedule_id=completed
    and session_date='2026-09-08' and started_at='2026-09-08 16:05+07' and ended_at='2026-09-08 17:25+07') then
    raise exception 'Linked lesson did not follow schedule';
  end if;
  if (select to_jsonb(s)-array['session_date','started_at','ended_at','updated_at'] from public.sessions s where id=lesson)
    is distinct from before_lesson then raise exception 'Lesson contents or ID changed'; end if;
  if (select to_jsonb(s)-array['start_at','end_at','updated_at'] from public.schedules s where id=completed)
    is distinct from before_schedule then raise exception 'Schedule contents or recurrence changed'; end if;

  -- Repeated correction must retain the same records and usage.
  perform public.move_schedule(completed,'2026-09-09','17:00');
  if (select count(*) from public.sessions where schedule_id=completed)<>1 then raise exception 'Duplicate lesson created'; end if;
  perform public.move_schedule(historical,'2026-09-15','18:00');
  if exists(select 1 from public.sessions where schedule_id=historical) then raise exception 'Empty historical schedule created a lesson'; end if;
  if not exists(select 1 from public.schedules where id=historical and status='completed' and start_at='2026-09-15 18:00+07')
    then raise exception 'Historical schedule move failed'; end if;
  perform public.move_schedule(upcoming,'2026-10-13','23:30');
  if not exists(select 1 from public.schedules where id=upcoming and status='scheduled'
    and start_at='2026-10-13 23:30+07' and end_at='2026-10-14 01:00+07') then raise exception 'Upcoming schedule duration lost'; end if;
  if (select start_at from public.schedules where id=cancelled) <> '2026-09-21 14:00+07' then raise exception 'Other occurrence moved'; end if;

  select jsonb_build_object(
    'packages',(select jsonb_agg(to_jsonb(p) order by p.id) from public.student_packages p where user_id=u),
    'invoices',(select jsonb_agg(to_jsonb(i) order by i.id) from public.invoices i where user_id=u),
    'payments',(select jsonb_agg(to_jsonb(p) order by p.id) from public.payments p where user_id=u),
    'attendance',(select jsonb_agg(to_jsonb(a) order by a.id) from public.attendance a where user_id=u)
  ) into after_money;
  if after_money is distinct from before_money then raise exception 'Move changed package usage, billing, payment or attendance'; end if;

  begin
    perform public.move_schedule(cancelled,'2026-09-22','14:00');
    raise exception 'Cancelled move accepted';
  exception when raise_exception then
    if sqlerrm <> 'Jadwal tidak ditemukan atau sudah dibatalkan.' then raise; end if;
  end;
  begin
    perform public.move_schedule(completed,null,'14:00');
    raise exception 'Null date accepted';
  exception when raise_exception then
    if sqlerrm <> 'Tanggal atau jam tidak valid.' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',other_u::text,true);
  begin
    perform public.move_schedule(completed,'2026-09-10','14:00');
    raise exception 'Foreign teacher move accepted';
  exception when raise_exception then
    if sqlerrm <> 'Jadwal tidak ditemukan atau sudah dibatalkan.' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.move_schedule(completed,'2026-09-10','14:00');
    raise exception 'Unauthenticated move accepted';
  exception when raise_exception then
    if sqlerrm <> 'Tidak terautentikasi.' then raise; end if;
  end;
  if has_function_privilege('anon','public.move_schedule(uuid,date,time without time zone)','execute') then
    raise exception 'Anonymous RPC exposed';
  end if;

  -- A failure updating the lesson must roll back the preceding schedule update.
  perform set_config('role','postgres',true);
  revoke update on public.sessions from authenticated;
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('role','authenticated',true);
  begin
    perform public.move_schedule(completed,'2026-09-10','20:00');
    raise exception 'Lesson update permission failure was ignored';
  exception when insufficient_privilege then null; end;
  if (select start_at from public.schedules where id=completed) <> '2026-09-09 17:00+07'
    or (select session_date from public.sessions where id=lesson) <> '2026-09-09' then
    raise exception 'Failed move left a partial update';
  end if;
  perform set_config('role','postgres',true);
  grant update on public.sessions to authenticated;
  update public.profiles set timezone='Asia/Makassar' where id=u;
  perform set_config('role','authenticated',true);
  perform public.move_schedule(historical,'2026-09-16','08:30');
  if (select start_at from public.schedules where id=historical) <> '2026-09-16 08:30+08' then
    raise exception 'Teacher timezone ignored';
  end if;
end $$;
rollback;
select 'PASS: completed/historical/upcoming moves, lesson preservation, package and payment integrity, RLS and atomic rollback' as result;

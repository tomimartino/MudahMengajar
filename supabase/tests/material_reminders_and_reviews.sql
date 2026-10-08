-- Run with: supabase db query --linked --file supabase/tests/material_reminders_and_reviews.sql
-- All fixtures, reviews, notifications, and settings changes are rolled back.
begin;
do $$
declare
  u uuid := gen_random_uuid(); other_u uuid := gen_random_uuid();
  student uuid := gen_random_uuid(); subject uuid := gen_random_uuid(); other_subject uuid := gen_random_uuid();
  upcoming uuid := gen_random_uuid(); previous uuid := gen_random_uuid(); absent uuid := gen_random_uuid();
  stored_read timestamptz; stored_created timestamptz; result jsonb;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (u, u::text || '@example.invalid', '{}'::jsonb),
    (other_u, other_u::text || '@example.invalid', '{}'::jsonb);
  insert into public.settings(user_id) values (u), (other_u) on conflict(user_id) do nothing;
  update public.settings set notify_schedule = false, notify_payment = false, notify_package = false,
    notify_material = true where user_id = u;
  insert into public.students(id, user_id, full_name, school_level, grade_level)
    values (student, u, 'Siswa pengujian', 'SD', '4');
  insert into public.subjects(id, user_id, name) values (subject, u, 'Matematika'), (other_subject, u, 'Bahasa');
  insert into public.schedules(id, user_id, student_id, subject_id, start_at, end_at)
    values (upcoming, u, student, subject, now() + interval '4 minutes', now() + interval '64 minutes');
  insert into public.sessions(id, user_id, student_id, subject_id, session_date, started_at, ended_at, material, homework)
    values (previous, u, student, subject, current_date - 1, now() - interval '1 day', now() - interval '23 hours', 'Pecahan', 'Latihan 1–5'),
      (gen_random_uuid(), u, student, other_subject, current_date, now() - interval '4 hours', now() - interval '3 hours', 'Bahasa', null),
      (absent, u, student, subject, current_date, now() - interval '2 hours', now() - interval '1 hour', 'Sesi tidak hadir', null);
  insert into public.attendance(user_id, session_id, student_id, status) values (u, absent, student, 'izin');
  insert into public.sessions(user_id, student_id, subject_id, session_date, started_at, ended_at, material, status)
    values (u, student, subject, current_date, now() - interval '3 hours', now() - interval '2 hours', 'Sesi batal', 'cancelled'),
      (u, student, subject, current_date + 1, now() + interval '1 day', now() + interval '25 hours', 'Masa depan', 'completed');

  perform public.refresh_reminders_for_user(u);
  if (select count(*) from public.notifications where user_id = u and type = 'material_review') <> 1 then
    raise exception 'Expected exactly one material reminder'; end if;
  if not exists(select 1 from public.notifications where user_id = u and body like '%Pecahan%' and body like '%Latihan 1–5%'
    and link = '/sessions/' || previous) then raise exception 'Wrong previous subject/attendance/content'; end if;
  update public.notifications set read_at = now() where user_id = u and type = 'material_review'
    returning read_at, created_at into stored_read, stored_created;
  perform public.refresh_reminders_for_user(u);
  if not exists(select 1 from public.notifications where user_id = u and type = 'material_review'
    and read_at = stored_read and created_at = stored_created) then raise exception 'Refresh reset read state'; end if;
  update public.sessions set material = 'Pecahan lanjutan' where id = previous;
  perform public.refresh_reminders_for_user(u);
  if not exists(select 1 from public.notifications where user_id = u and type = 'material_review'
    and body like '%Pecahan lanjutan%' and read_at = stored_read) then raise exception 'Edited material not updated'; end if;
  update public.settings set notify_material = false where user_id = u;
  perform public.refresh_reminders_for_user(u);
  if exists(select 1 from public.notifications where user_id = u and type = 'material_review') then raise exception 'Disabled reminder remained'; end if;
  update public.settings set notify_material = true where user_id = u;
  update public.schedules set start_at = now() + interval '6 minutes', end_at = now() + interval '66 minutes' where id = upcoming;
  perform public.refresh_reminders_for_user(u);
  if exists(select 1 from public.notifications where user_id = u and type = 'material_review') then raise exception 'Reminder too early'; end if;
  update public.schedules set status = 'cancelled' where id = upcoming;
  perform public.refresh_reminders_for_user(u);
  if exists(select 1 from public.notifications where user_id = u and type = 'material_review') then raise exception 'Cancelled schedule generated reminder'; end if;
  update public.schedules set status = 'scheduled', start_at = now() + interval '3 hours', end_at = now() + interval '4 hours' where id = upcoming;
  perform public.refresh_reminders_for_user(u);
  if exists(select 1 from public.notifications where user_id = u and type = 'material_review') then raise exception 'Moved schedule generated early reminder'; end if;
  update public.schedules set start_at = now() - interval '1 hour', end_at = now() where id = upcoming;
  perform public.refresh_reminders_for_user(u);
  if exists(select 1 from public.notifications where user_id = u and type = 'material_review') then raise exception 'Past schedule generated reminder'; end if;
  update public.schedules set start_at = now() + interval '4 minutes', end_at = now() + interval '64 minutes' where id = upcoming;

  perform set_config('test.owner', u::text, true);
  perform set_config('test.other', other_u::text, true);
  perform set_config('test.schedule', upcoming::text, true);
  perform set_config('test.previous', previous::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u, 'role', 'authenticated')::text, true);
  if has_function_privilege('authenticated', 'public.refresh_reminders_for_user(uuid)', 'execute')
    or has_function_privilege('anon', 'public.get_previous_session(uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.refresh_reminders_all()', 'execute') then
    raise exception 'Internal reminder entrypoint publicly executable'; end if;
end;
$$;

set local role authenticated;
do $$
declare result jsonb;
begin
  result := public.get_previous_session(current_setting('test.schedule')::uuid);
  if result->>'id' is distinct from current_setting('test.previous') then raise exception 'Previous session lookup failed'; end if;
  insert into public.app_reviews(user_id, rating, comment) values (auth.uid(), 5, 'Review pengujian pribadi.')
    on conflict(user_id) do update set rating = excluded.rating, comment = excluded.comment;
  insert into public.app_reviews(user_id, rating, comment) values (auth.uid(), 4, 'Review pengujian diperbarui.')
    on conflict(user_id) do update set rating = excluded.rating, comment = excluded.comment;
  if (select count(*) from public.app_reviews where user_id = auth.uid()) <> 1 then raise exception 'Duplicate review'; end if;
  begin
    insert into public.app_reviews(user_id, rating, comment) values (current_setting('test.other')::uuid, 5, 'Menulis review akun lain.');
    raise exception 'Cross-user review insert allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.app_reviews set user_id = current_setting('test.other')::uuid where user_id = auth.uid();
    raise exception 'Review ownership transfer allowed';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub', current_setting('test.other'), true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.other'), 'role', 'authenticated')::text, true);
  if exists(select 1 from public.app_reviews where user_id = current_setting('test.owner')::uuid) then raise exception 'Private review leaked'; end if;
  if public.get_previous_session(current_setting('test.schedule')::uuid) is not null then raise exception 'Other user material leaked'; end if;
  delete from public.app_reviews where user_id = current_setting('test.owner')::uuid;
  if found then raise exception 'Other user deleted review'; end if;
  perform set_config('request.jwt.claim.sub', current_setting('test.owner'), true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.owner'), 'role', 'authenticated')::text, true);
  delete from public.app_reviews where user_id = auth.uid();
  if not found then raise exception 'Own review deletion failed'; end if;
end;
$$;
reset role;
rollback;
select 'PASS: reminder timing, subject, attendance, read state, preferences, ownership, private review CRUD and RLS' as result;

-- Independent reminders: local midnight, one hour before, and material at five minutes.
-- Keep existing read/sent state when replacing the legacy schedule keys.
update public.push_log l set ref_key=l.ref_key||':'||extract(epoch from s.start_at)::text
  from public.schedules s where l.user_id=s.user_id
    and l.ref_key in ('schedule_today:'||s.id::text,'schedule_soon:'||s.id::text);
update public.notifications n set ref_key=n.ref_key||':'||extract(epoch from s.start_at)::text
  from public.schedules s where n.user_id=s.user_id
    and n.ref_key in ('schedule_today:'||s.id::text,'schedule_soon:'||s.id::text);
delete from public.notifications where type='material_review';

create or replace function private.refresh_schedule_reminders(p_uid uuid,p_now timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare v_item record; v_key text; v_keys text[]='{}';
begin
  if p_uid is null or p_now is null then return; end if;
  for v_item in
    select sched.id,sched.start_at,st.full_name,profile.timezone,
      event.type,event.title
    from public.schedules sched
    join public.students st on st.id=sched.student_id and st.user_id=sched.user_id
    join public.profiles profile on profile.id=sched.user_id
    join public.settings settings on settings.user_id=sched.user_id
    cross join lateral (values
      ('schedule_today','Jadwal hari ini',
        (sched.start_at at time zone profile.timezone)::date=(p_now at time zone profile.timezone)::date),
      ('schedule_soon','Jadwal dalam 1 jam',sched.start_at<=p_now+interval '1 hour')
    ) as event(type,title,due)
    where sched.user_id=p_uid and sched.status='scheduled' and sched.start_at>p_now
      and st.status='active' and st.deleted_at is null and settings.notify_schedule and event.due
  loop
    v_key=v_item.type||':'||v_item.id::text||':'||extract(epoch from v_item.start_at)::text;
    v_keys=array_append(v_keys,v_key);
    insert into public.notifications(user_id,type,ref_key,title,body,link)
      values(p_uid,v_item.type,v_key,v_item.title||' · '||v_item.full_name,
        'Mulai pukul '||to_char(v_item.start_at at time zone v_item.timezone,'HH24.MI')||'.',
        '/schedule')
      on conflict(user_id,ref_key) do update set title=excluded.title,body=excluded.body,link=excluded.link
      where (notifications.title,notifications.body,notifications.link)
        is distinct from (excluded.title,excluded.body,excluded.link);
  end loop;
  delete from public.notifications where user_id=p_uid
    and type in ('schedule_today','schedule_soon','schedule_upcoming') and not(ref_key=any(v_keys));
end $$;

create or replace function private.refresh_material_reminders(p_uid uuid,p_now timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare v_item record; v_key text; v_keys text[]='{}';
begin
  if p_uid is null or p_now is null then return; end if;
  for v_item in
    select sched.id as schedule_id,sched.start_at,st.full_name,profile.timezone,
      prev.id as session_id,prev.material,prev.sub_material,prev.homework
    from public.schedules sched
    join public.settings settings on settings.user_id=sched.user_id
    join public.profiles profile on profile.id=sched.user_id
    join public.students st on st.id=sched.student_id and st.user_id=sched.user_id
    cross join lateral (
      select sess.* from public.sessions sess
      where sess.user_id=sched.user_id and sess.student_id=sched.student_id
        and sess.subject_id is not distinct from sched.subject_id
        and sess.status='completed' and sess.schedule_id is distinct from sched.id
        and coalesce(sess.ended_at,sess.started_at,
          (sess.session_date+time '23:59:59') at time zone profile.timezone)<p_now
        and not exists(select 1 from public.attendance att where att.session_id=sess.id
          and att.user_id=sess.user_id and att.status<>'hadir')
      order by coalesce(sess.started_at,sess.session_date::timestamp at time zone profile.timezone) desc,
        sess.created_at desc,sess.id desc limit 1
    ) prev
    where sched.user_id=p_uid and sched.status='scheduled' and settings.notify_material
      and st.status='active' and st.deleted_at is null
      and sched.start_at>p_now and sched.start_at<=p_now+interval '5 minutes'
  loop
    v_key='material_review:'||v_item.schedule_id::text||':'||extract(epoch from v_item.start_at)::text;
    v_keys=array_append(v_keys,v_key);
    insert into public.notifications(user_id,type,ref_key,title,body,link)
    values(p_uid,'material_review',v_key,'Materi sebelumnya · '||v_item.full_name,
      'Mulai pukul '||to_char(v_item.start_at at time zone v_item.timezone,'HH24.MI')||'. '||
      'Materi: '||coalesce(nullif(left(btrim(v_item.material),160),''),'belum diisi')||
      case when nullif(btrim(v_item.sub_material),'') is not null
        then ' · '||left(btrim(v_item.sub_material),80) else '' end||
      case when nullif(btrim(v_item.homework),'') is not null
        then '. PR: '||left(btrim(v_item.homework),160) else '' end,
      '/sessions/'||v_item.session_id)
    on conflict(user_id,ref_key) do update set title=excluded.title,body=excluded.body,link=excluded.link
    where (notifications.title,notifications.body,notifications.link)
      is distinct from (excluded.title,excluded.body,excluded.link);
  end loop;
  delete from public.notifications where user_id=p_uid and type='material_review' and not(ref_key=any(v_keys));
end $$;
revoke all on function private.refresh_schedule_reminders(uuid,timestamptz),
  private.refresh_material_reminders(uuid,timestamptz) from public,anon,authenticated;
create or replace function public.refresh_reminders_for_user(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_today date;
  v_stg record;
  v_s record;
  v_i record;
  v_p record;
begin
  if p_uid is null then
    return;
  end if;

  select coalesce(timezone, 'Asia/Jakarta') into v_tz from public.profiles where id = p_uid;
  v_today := (now() at time zone v_tz)::date;

  select * into v_stg from public.settings where user_id = p_uid;
  if not found then
    insert into public.settings (user_id) values (p_uid) returning * into v_stg;
  end if;

  delete from public.notifications
    where user_id = p_uid and read_at is null
      and type in (
                   'payment_due', 'payment_overdue', 'package_low');

  perform private.refresh_schedule_reminders(p_uid, now());

  if v_stg.notify_payment then
    for v_i in
      select i.id, st.full_name, i.amount, i.due_date, i.period_label
        from public.invoices i
        join public.students st on st.id = i.student_id
        where i.user_id = p_uid and i.status in ('unpaid', 'partial')
          and i.due_date is not null
          and i.due_date >= v_today
          and i.due_date <= v_today + v_stg.payment_reminder_days
    loop
      insert into public.notifications (user_id, type, ref_key, title, body, link)
      values (p_uid, 'payment_due', 'payment_due:' || v_i.id,
              'Pembayaran jatuh tempo',
              'Pembayaran ' || v_i.full_name || ' (' || coalesce(v_i.period_label, 'tagihan') ||
                ') jatuh tempo ' || to_char(v_i.due_date, 'DD Mon YYYY') || '.',
              '/payments')
      on conflict (user_id, ref_key) do nothing;
    end loop;

    for v_i in
      select i.id, st.full_name, i.amount, i.due_date, i.period_label
        from public.invoices i
        join public.students st on st.id = i.student_id
        where i.user_id = p_uid and i.status in ('unpaid', 'partial')
          and i.due_date is not null and i.due_date < v_today
    loop
      insert into public.notifications (user_id, type, ref_key, title, body, link)
      values (p_uid, 'payment_overdue', 'payment_overdue:' || v_i.id,
              'Pembayaran terlambat',
              'Pembayaran ' || v_i.full_name || ' (' || coalesce(v_i.period_label, 'tagihan') ||
                ') sudah lewat jatuh tempo (' || to_char(v_i.due_date, 'DD Mon YYYY') || ').',
              '/payments')
      on conflict (user_id, ref_key) do nothing;
    end loop;
  end if;

  if v_stg.notify_package then
    for v_p in
      select p.id, st.full_name, p.total_sessions, p.sessions_used, p.student_id
        from public.student_packages p
        join public.students st on st.id = p.student_id
        where p.user_id = p_uid and p.status = 'active'
          and p.sessions_used < p.total_sessions
          and (p.total_sessions - p.sessions_used) <= v_stg.package_low_threshold
    loop
      insert into public.notifications (user_id, type, ref_key, title, body, link)
      values (p_uid, 'package_low', 'package_low:' || v_p.id,
              'Paket hampir habis',
              'Paket ' || v_p.full_name || ' tersisa ' ||
                (v_p.total_sessions - v_p.sessions_used) || ' pertemuan.',
              '/students/' || v_p.student_id)
      on conflict (user_id, ref_key) do nothing;
    end loop;
  end if;
  perform private.refresh_material_reminders(p_uid, now());
end;
$$;


revoke execute on function public.refresh_reminders_for_user(uuid) from public,anon,authenticated;
grant execute on function public.refresh_reminders_for_user(uuid) to service_role;
drop function private.refresh_material_reminders(uuid);
alter table public.settings drop column material_reminder_minutes;

-- Reuse the configured job and credentials; improve timing resolution to one minute.
do $$ declare v_job bigint; begin
  select jobid into v_job from cron.job where jobname='send-push-notifications';
  if v_job is not null then perform cron.alter_job(v_job,schedule:='* * * * *'); end if;
end $$;

-- ============================================================
-- MudahMengajar — 0010_schedule_soon_notification.sql
-- Notifikasi baru "Jadwal dalam 1 jam" (schedule_soon):
-- dibuat ketika jadwal mengajar akan mulai dalam 1 jam ke depan,
-- melengkapi notifikasi harian "Jadwal hari ini" (schedule_today).
-- Mengikuti toggle settings.notify_schedule yang sudah ada.
-- ============================================================

-- 1. Tambah tipe 'schedule_soon' ke constraint notifications.type
do $$
declare
  v_con text;
begin
  select conname into v_con
    from pg_constraint
    where conrelid = 'public.notifications'::regclass and contype = 'c';
  execute format('alter table public.notifications drop constraint %I', v_con);
end $$;

alter table public.notifications add constraint notifications_type_check
  check (type in ('schedule_today', 'schedule_upcoming', 'schedule_soon',
                  'payment_due', 'payment_overdue', 'package_low', 'info'));

-- 2. Inti logika pengingat: tambah pembuatan notifikasi schedule_soon.
create or replace function public.refresh_reminders_for_user(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
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
      and type in ('schedule_today', 'schedule_soon',
                   'payment_due', 'payment_overdue', 'package_low');

  if v_stg.notify_schedule then
    for v_s in
      select s.id, st.full_name, s.start_at
        from public.schedules s
        join public.students st on st.id = s.student_id
        where s.user_id = p_uid and s.status = 'scheduled'
          and (s.start_at at time zone v_tz)::date = v_today
        order by s.start_at
    loop
      insert into public.notifications (user_id, type, ref_key, title, body, link)
      values (p_uid, 'schedule_today', 'schedule_today:' || v_s.id,
              'Jadwal hari ini',
              v_s.full_name || ' memiliki jadwal pukul ' ||
                to_char(v_s.start_at at time zone v_tz, 'HH24.MI') || '.',
              '/schedule')
      on conflict (user_id, ref_key) do nothing;
    end loop;

    for v_s in
      select s.id, st.full_name, s.start_at
        from public.schedules s
        join public.students st on st.id = s.student_id
        where s.user_id = p_uid and s.status = 'scheduled'
          and s.start_at > now() and s.start_at <= now() + interval '1 hour'
        order by s.start_at
    loop
      insert into public.notifications (user_id, type, ref_key, title, body, link)
      values (p_uid, 'schedule_soon', 'schedule_soon:' || v_s.id,
              'Jadwal dalam 1 jam',
              v_s.full_name || ' memiliki jadwal 1 jam lagi pukul ' ||
                to_char(v_s.start_at at time zone v_tz, 'HH24.MI') || '.',
              '/schedule')
      on conflict (user_id, ref_key) do nothing;
    end loop;
  end if;

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
end;
$$;

revoke execute on function public.refresh_reminders_for_user(uuid) from public;

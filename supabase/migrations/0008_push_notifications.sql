-- ============================================================
-- MudahMengajar — 0008_push_notifications.sql
-- Web Push ke HP pengguna:
--  1. Tabel subscription push per perangkat (push_subscriptions)
--  2. Tabel log pengiriman anti-duplikat (push_log)
--  3. Refactor refresh_reminders agar scheduler bisa membuat
--     ulang notifikasi untuk SEMUA pengguna (tanpa auth.uid())
--  4. pg_cron + pg_net: panggil Edge Function "send-push" tiap 5 menit
--
-- SETUP MANUAL setelah deploy (jalankan sekali di SQL Editor):
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-push', 'push_function_url');
--   select vault.create_secret('<service_role_key>', 'push_service_key');
-- ============================================================

-- 1. Subscription push per perangkat yang mengaktifkan notifikasi
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index idx_push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_own on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. Log pengiriman push (anti-duplikat). Hanya service role (Edge Function).
create table public.push_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  ref_key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, ref_key)
);

alter table public.push_log enable row level security;

-- 3a. Inti logika pengingat tanpa cek auth — hanya dipanggil internal.
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
      and type in ('schedule_today', 'payment_due', 'payment_overdue', 'package_low');

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

-- 3b. Wrapper untuk pemanggilan dari aplikasi (tetap wajib terautentikasi).
create or replace function public.refresh_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Tidak terautentikasi' using errcode = 'P0001';
  end if;
  perform public.refresh_reminders_for_user(v_uid);
end;
$$;

grant execute on function public.refresh_reminders() to authenticated;

-- 3c. Untuk scheduler: refresh pengingat semua pengguna (dipanggil Edge Function via service role).
create or replace function public.refresh_reminders_all()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p record;
begin
  for v_p in select id from public.profiles loop
    perform public.refresh_reminders_for_user(v_p.id);
  end loop;
end;
$$;

revoke execute on function public.refresh_reminders_all() from public;
grant execute on function public.refresh_reminders_all() to service_role;

-- 4. Scheduler: panggil Edge Function "send-push" tiap 5 menit
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule(
  'send-push-notifications',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'push_function_url'),
    headers := jsonb_build_object(
      'Content-type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'push_service_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

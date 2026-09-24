-- ============================================================
-- MudahMengajar — 0001_init.sql
-- Skema dasar: 14 tabel + RLS + trigger + 7 RPC transaksional
-- ============================================================

create extension if not exists pgcrypto;

-- ============================= TABLES =============================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  whatsapp text,
  business_name text,
  address text,
  avatar_url text,
  teaching_levels text[] not null default '{}',
  timezone text not null default 'Asia/Jakarta',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.parents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  whatsapp text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, whatsapp)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.parents(id) on delete set null,
  full_name text not null,
  gender text check (gender in ('L', 'P')),
  birth_date date,
  school_name text,
  school_level text not null check (school_level in ('SD', 'SMP', 'SMA', 'Umum')),
  grade_level text not null,
  phone text,
  address text,
  notes text,
  learning_mode text not null default 'offline' check (learning_mode in ('offline', 'online', 'hybrid')),
  billing_type text not null default 'per_session' check (billing_type in ('per_session', 'package', 'monthly')),
  per_session_rate numeric(12, 0) check (per_session_rate is null or per_session_rate > 0),
  monthly_fee numeric(12, 0) check (monthly_fee is null or monthly_fee > 0),
  monthly_due_day int check (monthly_due_day between 1 and 31),
  status text not null default 'active' check (status in ('active', 'inactive')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, subject_id)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  invoice_number text not null,
  type text not null check (type in ('package', 'monthly', 'per_session', 'other')),
  period_label text,
  amount numeric(12, 0) not null check (amount > 0),
  due_date date,
  status text not null default 'unpaid' check (status in ('unpaid', 'partial', 'paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, invoice_number)
);

create table public.student_packages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  total_sessions int not null check (total_sessions > 0),
  sessions_used int not null default 0 check (sessions_used >= 0),
  price numeric(12, 0) not null check (price > 0),
  start_date date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sessions_used <= total_sessions)
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.subjects(id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  learning_mode text check (learning_mode in ('offline', 'online', 'hybrid')),
  location text,
  notes text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  recurrence_id uuid references public.schedules(id) on delete cascade,
  recurrence_rule jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id),
  schedule_id uuid references public.schedules(id) on delete set null,
  subject_id uuid references public.subjects(id),
  session_date date not null,
  started_at timestamptz,
  ended_at timestamptz,
  duration_minutes int check (duration_minutes >= 0),
  material text,
  sub_material text,
  learning_notes text,
  homework text,
  score numeric(5, 2) check (score between 0 and 100),
  progress_notes text,
  status text not null default 'completed' check (status in ('completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_id uuid not null references public.students(id),
  status text not null check (status in ('hadir', 'izin', 'sakit', 'alpha', 'dibatalkan_guru', 'dibatalkan_siswa')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id),
  invoice_id uuid references public.invoices(id) on delete set null,
  type text not null check (type in ('package', 'monthly', 'per_session', 'other')),
  amount numeric(12, 0) not null check (amount > 0),
  payment_date date not null,
  method text not null check (method in ('cash', 'bank_transfer', 'ewallet', 'other')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expense_date date not null,
  category text not null check (category in ('stationery', 'internet', 'transport', 'printing', 'rent', 'books', 'other')),
  description text not null,
  amount numeric(12, 0) not null check (amount > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('schedule_today', 'schedule_upcoming', 'payment_due', 'payment_overdue', 'package_low', 'info')),
  ref_key text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, ref_key)
);

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  default_duration_minutes int not null default 90,
  default_learning_mode text not null default 'offline',
  deduct_package_policy text not null default 'hadir_only'
    check (deduct_package_policy in ('hadir_only', 'include_izin_sakit', 'all_except_cancelled')),
  payment_reminder_days int not null default 3,
  package_low_threshold int not null default 2,
  notify_schedule boolean not null default true,
  notify_payment boolean not null default true,
  notify_package boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================= INDEXES =============================

create index idx_subjects_user on public.subjects(user_id);
create index idx_parents_user on public.parents(user_id);
create index idx_students_user on public.students(user_id);
create index idx_students_user_status on public.students(user_id, status);
create index idx_students_user_deleted on public.students(user_id, deleted_at);
create index idx_student_subjects_student on public.student_subjects(student_id);
create index idx_invoices_user on public.invoices(user_id);
create index idx_invoices_student on public.invoices(student_id);
create index idx_invoices_status on public.invoices(status);
create index idx_invoices_user_due on public.invoices(user_id, due_date);
create index idx_packages_user on public.student_packages(user_id);
create index idx_packages_student on public.student_packages(student_id);
create index idx_packages_status on public.student_packages(status);
create index idx_schedules_user_start on public.schedules(user_id, start_at);
create index idx_schedules_student on public.schedules(student_id);
create index idx_schedules_status on public.schedules(status);
create unique index idx_schedules_recurrence_start on public.schedules(recurrence_id, start_at)
  where recurrence_id is not null;
create index idx_sessions_user on public.sessions(user_id);
create index idx_sessions_student_date on public.sessions(student_id, session_date);
create unique index idx_sessions_schedule on public.sessions(schedule_id)
  where schedule_id is not null;
create index idx_attendance_user on public.attendance(user_id);
create index idx_attendance_student_status on public.attendance(student_id, status);
create index idx_payments_user on public.payments(user_id);
create index idx_payments_student on public.payments(student_id);
create index idx_payments_invoice on public.payments(invoice_id);
create index idx_payments_date on public.payments(payment_date);
create index idx_expenses_user on public.expenses(user_id);
create index idx_expenses_date on public.expenses(expense_date);
create index idx_expenses_category on public.expenses(category);
create index idx_notifications_user_read on public.notifications(user_id, read_at);
create index idx_notifications_user_created on public.notifications(user_id, created_at);

-- ============================= updated_at TRIGGER =============================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_subjects_updated_at before update on public.subjects
  for each row execute function public.set_updated_at();
create trigger trg_parents_updated_at before update on public.parents
  for each row execute function public.set_updated_at();
create trigger trg_students_updated_at before update on public.students
  for each row execute function public.set_updated_at();
create trigger trg_invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();
create trigger trg_packages_updated_at before update on public.student_packages
  for each row execute function public.set_updated_at();
create trigger trg_schedules_updated_at before update on public.schedules
  for each row execute function public.set_updated_at();
create trigger trg_sessions_updated_at before update on public.sessions
  for each row execute function public.set_updated_at();
create trigger trg_attendance_updated_at before update on public.attendance
  for each row execute function public.set_updated_at();
create trigger trg_payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
create trigger trg_expenses_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();
create trigger trg_settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- ============================= RLS =============================

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.parents enable row level security;
alter table public.students enable row level security;
alter table public.student_subjects enable row level security;
alter table public.invoices enable row level security;
alter table public.student_packages enable row level security;
alter table public.schedules enable row level security;
alter table public.sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.notifications enable row level security;
alter table public.settings enable row level security;

create policy profiles_own on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy subjects_own on public.subjects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy parents_own on public.parents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy students_own on public.students
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy student_subjects_own on public.student_subjects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy invoices_own on public.invoices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy packages_own on public.student_packages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy schedules_own on public.schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy sessions_own on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy attendance_own on public.attendance
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy payments_own on public.payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy expenses_own on public.expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy notifications_own on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy settings_own on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================= AUTH TRIGGER =============================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.settings (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================= RPC: complete_session =============================

create or replace function public.complete_session(
  p_schedule_id uuid,
  p_attendance text,
  p_duration_minutes int,
  p_material text default null,
  p_sub_material text default null,
  p_learning_notes text default null,
  p_homework text default null,
  p_score numeric default null,
  p_progress_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_sched record;
  v_session_id uuid;
  v_pkg record;
  v_policy text;
  v_deduct boolean;
begin
  if v_uid is null then
    raise exception 'Tidak terautentikasi' using errcode = 'P0001';
  end if;
  if p_attendance not in ('hadir', 'izin', 'sakit', 'alpha', 'dibatalkan_guru', 'dibatalkan_siswa') then
    raise exception 'Status kehadiran tidak valid' using errcode = 'P0001';
  end if;

  select coalesce(p.timezone, 'Asia/Jakarta') into v_tz from public.profiles p where p.id = v_uid;

  select * into v_sched from public.schedules
    where id = p_schedule_id and user_id = v_uid and status = 'scheduled'
    for update;
  if not found then
    raise exception 'Jadwal tidak ditemukan atau sudah selesai' using errcode = 'P0001';
  end if;

  insert into public.sessions
    (user_id, student_id, schedule_id, subject_id, session_date, started_at, ended_at,
     duration_minutes, material, sub_material, learning_notes, homework, score, progress_notes, status)
  values
    (v_uid, v_sched.student_id, p_schedule_id, v_sched.subject_id,
     (v_sched.start_at at time zone v_tz)::date, v_sched.start_at, v_sched.end_at,
     p_duration_minutes, p_material, p_sub_material, p_learning_notes, p_homework,
     p_score, p_progress_notes, 'completed')
  returning id into v_session_id;

  insert into public.attendance (user_id, session_id, student_id, status)
  values (v_uid, v_session_id, v_sched.student_id, p_attendance);

  select coalesce(s.deduct_package_policy, 'hadir_only') into v_policy
    from public.settings s where s.user_id = v_uid;

  v_deduct :=
    (v_policy = 'hadir_only' and p_attendance = 'hadir')
    or (v_policy = 'include_izin_sakit' and p_attendance in ('hadir', 'izin', 'sakit'))
    or (v_policy = 'all_except_cancelled' and p_attendance in ('hadir', 'izin', 'sakit', 'alpha'));

  if v_deduct then
    select * into v_pkg from public.student_packages
      where user_id = v_uid and student_id = v_sched.student_id and status = 'active'
      order by created_at desc
      limit 1
      for update;
    if found then
      if v_pkg.sessions_used < v_pkg.total_sessions then
        update public.student_packages
          set sessions_used = sessions_used + 1
          where id = v_pkg.id;
      else
        insert into public.notifications (user_id, type, ref_key, title, body, link)
        values (v_uid, 'package_low', 'package_exhausted:' || v_pkg.id,
                'Paket habis',
                'Paket pertemuan siswa ini sudah habis. Buat paket baru agar pertemuan berikutnya tetap terhitung.',
                '/students/' || v_sched.student_id)
        on conflict (user_id, ref_key) do nothing;
      end if;
    end if;
  end if;

  update public.schedules set status = 'completed' where id = p_schedule_id;

  return v_session_id;
end;
$$;

-- ============================= RPC: record_payment =============================

create or replace function public.record_payment(
  p_student_id uuid,
  p_invoice_id uuid,
  p_type text,
  p_amount numeric,
  p_payment_date date,
  p_method text,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_payment_id uuid;
  v_inv record;
  v_total numeric;
  v_status text;
begin
  if v_uid is null then
    raise exception 'Tidak terautentikasi' using errcode = 'P0001';
  end if;
  if p_amount <= 0 then
    raise exception 'Nominal harus lebih dari 0' using errcode = 'P0001';
  end if;
  if p_type not in ('package', 'monthly', 'per_session', 'other') then
    raise exception 'Jenis pembayaran tidak valid' using errcode = 'P0001';
  end if;
  if p_method not in ('cash', 'bank_transfer', 'ewallet', 'other') then
    raise exception 'Metode pembayaran tidak valid' using errcode = 'P0001';
  end if;

  perform 1 from public.students
    where id = p_student_id and user_id = v_uid and deleted_at is null;
  if not found then
    raise exception 'Siswa tidak ditemukan' using errcode = 'P0001';
  end if;

  if p_invoice_id is not null then
    select * into v_inv from public.invoices
      where id = p_invoice_id and user_id = v_uid
      for update;
    if not found then
      raise exception 'Tagihan tidak ditemukan' using errcode = 'P0001';
    end if;
    if v_inv.student_id <> p_student_id then
      raise exception 'Tagihan bukan milik siswa ini' using errcode = 'P0001';
    end if;
  end if;

  insert into public.payments (user_id, student_id, invoice_id, type, amount, payment_date, method, notes)
  values (v_uid, p_student_id, p_invoice_id, p_type, p_amount, p_payment_date, p_method, p_notes)
  returning id into v_payment_id;

  if p_invoice_id is not null then
    select coalesce(sum(amount), 0) into v_total
      from public.payments where invoice_id = p_invoice_id;
    if v_total > v_inv.amount then
      raise exception 'Nominal melebihi sisa tagihan' using errcode = 'P0001';
    elsif v_total >= v_inv.amount then
      v_status := 'paid';
    elsif v_total > 0 then
      v_status := 'partial';
    else
      v_status := 'unpaid';
    end if;
    update public.invoices set status = v_status where id = p_invoice_id;
  end if;

  return jsonb_build_object('payment_id', v_payment_id, 'invoice_status', v_status);
end;
$$;

-- ============================= RPC: create_package =============================

create or replace function public.create_package(
  p_student_id uuid,
  p_total_sessions int,
  p_price numeric,
  p_start_date date
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_seq int;
  v_number text;
  v_invoice_id uuid;
  v_pkg_id uuid;
begin
  if v_uid is null then
    raise exception 'Tidak terautentikasi' using errcode = 'P0001';
  end if;
  if p_total_sessions <= 0 or p_price <= 0 then
    raise exception 'Jumlah pertemuan dan harga harus lebih dari 0' using errcode = 'P0001';
  end if;

  perform 1 from public.students
    where id = p_student_id and user_id = v_uid and deleted_at is null;
  if not found then
    raise exception 'Siswa tidak ditemukan' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('invoice_seq:' || v_uid::text));

  select coalesce(
    max(((regexp_match(invoice_number, '^INV-\d{4}-(\d+)$'))[1])::int), 0
  ) + 1 into v_seq
    from public.invoices where user_id = v_uid;

  v_number := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(v_seq::text, 4, '0');

  insert into public.invoices (user_id, student_id, invoice_number, type, period_label, amount, due_date, status)
  values (v_uid, p_student_id, v_number, 'package', 'Paket ' || p_total_sessions || 'x Pertemuan',
          p_price, p_start_date, 'unpaid')
  returning id into v_invoice_id;

  insert into public.student_packages (user_id, student_id, invoice_id, total_sessions, price, start_date)
  values (v_uid, p_student_id, v_invoice_id, p_total_sessions, p_price, p_start_date)
  returning id into v_pkg_id;

  return jsonb_build_object('package_id', v_pkg_id, 'invoice_id', v_invoice_id, 'invoice_number', v_number);
end;
$$;

-- ============================= RPC: generate_monthly_invoices =============================

create or replace function public.generate_monthly_invoices(
  p_year int,
  p_month int,
  p_period_label text
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_student record;
  v_days_in_month int;
  v_due_day int;
  v_due_date date;
  v_seq int;
  v_number text;
  v_count int := 0;
begin
  if v_uid is null then
    raise exception 'Tidak terautentikasi' using errcode = 'P0001';
  end if;

  v_days_in_month := extract(day from (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day'))::int;

  for v_student in
    select * from public.students
      where user_id = v_uid and status = 'active' and deleted_at is null
        and billing_type = 'monthly' and monthly_fee is not null and monthly_fee > 0
  loop
    perform 1 from public.invoices
      where user_id = v_uid and student_id = v_student.id and type = 'monthly'
        and due_date >= make_date(p_year, p_month, 1)
        and due_date < make_date(p_year, p_month, 1) + interval '1 month'
      limit 1;
    if not found then
      v_due_day := least(coalesce(v_student.monthly_due_day, 1), v_days_in_month);
      v_due_date := make_date(p_year, p_month, v_due_day);

      perform pg_advisory_xact_lock(hashtext('invoice_seq:' || v_uid::text));
      select coalesce(
        max(((regexp_match(invoice_number, '^INV-\d{4}-(\d+)$'))[1])::int), 0
      ) + 1 into v_seq
        from public.invoices where user_id = v_uid;
      v_number := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(v_seq::text, 4, '0');

      insert into public.invoices (user_id, student_id, invoice_number, type, period_label, amount, due_date, status)
      values (v_uid, v_student.id, v_number, 'monthly', p_period_label, v_student.monthly_fee, v_due_date, 'unpaid');
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- ============================= RPC: generate_schedule_occurrences =============================

create or replace function public.generate_schedule_occurrences(
  p_master_id uuid,
  p_until date
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_master record;
  v_start_date date;
  v_start_time time;
  v_end_time time;
  v_freq text;
  v_interval int;
  v_days int[];
  v_date date;
  v_weekday int;
  v_count int := 0;
begin
  if v_uid is null then
    raise exception 'Tidak terautentikasi' using errcode = 'P0001';
  end if;

  select coalesce(p.timezone, 'Asia/Jakarta') into v_tz from public.profiles p where p.id = v_uid;

  select * into v_master from public.schedules
    where id = p_master_id and user_id = v_uid and recurrence_rule is not null;
  if not found then
    raise exception 'Jadwal berulang tidak ditemukan' using errcode = 'P0001';
  end if;

  v_start_date := (v_master.start_at at time zone v_tz)::date;
  v_start_time := (v_master.start_at at time zone v_tz)::time;
  v_end_time := (v_master.end_at at time zone v_tz)::time;
  v_freq := coalesce(v_master.recurrence_rule ->> 'frequency', 'weekly');
  v_interval := greatest(coalesce((v_master.recurrence_rule ->> 'interval')::int, 1), 1);

  select coalesce(array_agg(x::int), array[]::int[]) into v_days
    from jsonb_array_elements_text(coalesce(v_master.recurrence_rule -> 'days', '[]'::jsonb)) as x;

  if v_freq = 'custom' and coalesce(array_length(v_days, 1), 0) = 0 then
    raise exception 'Aturan pengulangan tidak valid' using errcode = 'P0001';
  end if;

  if v_freq = 'custom' then
    v_date := v_start_date + 1;
    loop
      exit when v_date > p_until;
      v_weekday := extract(isodow from v_date)::int;
      if v_weekday = any(v_days) then
        insert into public.schedules
          (user_id, student_id, subject_id, start_at, end_at, learning_mode, location, notes, status, recurrence_id)
        values
          (v_master.user_id, v_master.student_id, v_master.subject_id,
           (v_date + v_start_time) at time zone v_tz,
           (v_date + v_end_time) at time zone v_tz,
           v_master.learning_mode, v_master.location, v_master.notes, 'scheduled', p_master_id)
        on conflict (recurrence_id, start_at) do nothing;
        v_count := v_count + 1;
      end if;
      v_date := v_date + 1;
    end loop;
  else
    v_date := v_start_date + (7 * v_interval);
    loop
      exit when v_date > p_until;
      insert into public.schedules
        (user_id, student_id, subject_id, start_at, end_at, learning_mode, location, notes, status, recurrence_id)
      values
        (v_master.user_id, v_master.student_id, v_master.subject_id,
         (v_date + v_start_time) at time zone v_tz,
         (v_date + v_end_time) at time zone v_tz,
         v_master.learning_mode, v_master.location, v_master.notes, 'scheduled', p_master_id)
      on conflict (recurrence_id, start_at) do nothing;
      v_count := v_count + 1;
      v_date := v_date + (7 * v_interval);
    end loop;
  end if;

  return v_count;
end;
$$;

-- ============================= RPC: create_invoice =============================

create or replace function public.create_invoice(
  p_student_id uuid,
  p_type text,
  p_period_label text,
  p_amount numeric,
  p_due_date date
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_seq int;
  v_number text;
  v_invoice_id uuid;
begin
  if v_uid is null then
    raise exception 'Tidak terautentikasi' using errcode = 'P0001';
  end if;
  if p_amount <= 0 then
    raise exception 'Nominal harus lebih dari 0' using errcode = 'P0001';
  end if;
  if p_type not in ('monthly', 'per_session', 'other') then
    raise exception 'Jenis tagihan tidak valid' using errcode = 'P0001';
  end if;

  perform 1 from public.students
    where id = p_student_id and user_id = v_uid and deleted_at is null;
  if not found then
    raise exception 'Siswa tidak ditemukan' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('invoice_seq:' || v_uid::text));
  select coalesce(
    max(((regexp_match(invoice_number, '^INV-\d{4}-(\d+)$'))[1])::int), 0
  ) + 1 into v_seq
    from public.invoices where user_id = v_uid;
  v_number := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(v_seq::text, 4, '0');

  insert into public.invoices (user_id, student_id, invoice_number, type, period_label, amount, due_date, status)
  values (v_uid, p_student_id, v_number, p_type, p_period_label, p_amount, p_due_date, 'unpaid')
  returning id into v_invoice_id;

  return jsonb_build_object('invoice_id', v_invoice_id, 'invoice_number', v_number);
end;
$$;

-- ============================= RPC: get_dashboard_stats =============================

create or replace function public.get_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_today date;
  v_month_start date;
  v_month_end date;
  v_schedules_today bigint;
  v_active_students bigint;
  v_open_invoices bigint;
  v_month_income numeric;
  v_today_list jsonb;
  v_next_list jsonb;
  v_reminders jsonb;
begin
  if v_uid is null then
    raise exception 'Tidak terautentikasi' using errcode = 'P0001';
  end if;

  select coalesce(timezone, 'Asia/Jakarta') into v_tz from public.profiles where id = v_uid;
  v_today := (now() at time zone v_tz)::date;
  v_month_start := date_trunc('month', now() at time zone v_tz)::date;
  v_month_end := (date_trunc('month', now() at time zone v_tz) + interval '1 month')::date;

  select count(*) into v_schedules_today from public.schedules s
    where s.user_id = v_uid and s.status = 'scheduled'
      and (s.start_at at time zone v_tz)::date = v_today;

  select count(*) into v_active_students from public.students
    where user_id = v_uid and status = 'active' and deleted_at is null;

  select count(*) into v_open_invoices from public.invoices
    where user_id = v_uid and status in ('unpaid', 'partial');

  select coalesce(sum(amount), 0) into v_month_income from public.payments
    where user_id = v_uid and payment_date >= v_month_start and payment_date < v_month_end;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_today_list from (
    select s.id, s.start_at, s.end_at, s.status, s.learning_mode, s.location,
           st.full_name as student_name, st.grade_level, st.school_level,
           sub.name as subject_name
      from public.schedules s
      join public.students st on st.id = s.student_id
      join public.subjects sub on sub.id = s.subject_id
      where s.user_id = v_uid and s.status = 'scheduled'
        and (s.start_at at time zone v_tz)::date = v_today
      order by s.start_at
  ) x;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_next_list from (
    select s.id, s.start_at, s.end_at, s.status, s.learning_mode,
           st.full_name as student_name, sub.name as subject_name
      from public.schedules s
      join public.students st on st.id = s.student_id
      join public.subjects sub on sub.id = s.subject_id
      where s.user_id = v_uid and s.status = 'scheduled'
        and (s.start_at at time zone v_tz)::date > v_today
      order by s.start_at
      limit 5
  ) x;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_reminders from (
    select id, type, title, body, link, read_at, created_at
      from public.notifications
      where user_id = v_uid and read_at is null
      order by created_at desc
      limit 6
  ) x;

  return jsonb_build_object(
    'schedules_today', v_schedules_today,
    'active_students', v_active_students,
    'open_invoices', v_open_invoices,
    'month_income', v_month_income,
    'today_schedules', v_today_list,
    'next_schedules', v_next_list,
    'reminders', v_reminders
  );
end;
$$;

-- ============================= RPC: refresh_reminders =============================

create or replace function public.refresh_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_today date;
  v_stg record;
  v_s record;
  v_i record;
  v_p record;
begin
  if v_uid is null then
    raise exception 'Tidak terautentikasi' using errcode = 'P0001';
  end if;

  select coalesce(timezone, 'Asia/Jakarta') into v_tz from public.profiles where id = v_uid;
  v_today := (now() at time zone v_tz)::date;

  select * into v_stg from public.settings where user_id = v_uid;
  if not found then
    insert into public.settings (user_id) values (v_uid) returning * into v_stg;
  end if;

  delete from public.notifications
    where user_id = v_uid and read_at is null
      and type in ('schedule_today', 'schedule_upcoming', 'payment_due', 'payment_overdue', 'package_low');

  if v_stg.notify_schedule then
    for v_s in
      select s.id, st.full_name, s.start_at
        from public.schedules s
        join public.students st on st.id = s.student_id
        where s.user_id = v_uid and s.status = 'scheduled'
          and (s.start_at at time zone v_tz)::date = v_today
        order by s.start_at
    loop
      insert into public.notifications (user_id, type, ref_key, title, body, link)
      values (v_uid, 'schedule_today', 'schedule_today:' || v_s.id,
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
        where s.user_id = v_uid and s.status = 'scheduled'
          and (s.start_at at time zone v_tz)::date > v_today
        order by s.start_at
        limit 3
    loop
      insert into public.notifications (user_id, type, ref_key, title, body, link)
      values (v_uid, 'schedule_upcoming', 'schedule_upcoming:' || v_s.id,
              'Jadwal berikutnya',
              v_s.full_name || ' dijadwalkan pada ' ||
                to_char(v_s.start_at at time zone v_tz, 'DD Mon') || ' pukul ' ||
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
        where i.user_id = v_uid and i.status in ('unpaid', 'partial')
          and i.due_date is not null
          and i.due_date >= v_today
          and i.due_date <= v_today + v_stg.payment_reminder_days
    loop
      insert into public.notifications (user_id, type, ref_key, title, body, link)
      values (v_uid, 'payment_due', 'payment_due:' || v_i.id,
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
        where i.user_id = v_uid and i.status in ('unpaid', 'partial')
          and i.due_date is not null and i.due_date < v_today
    loop
      insert into public.notifications (user_id, type, ref_key, title, body, link)
      values (v_uid, 'payment_overdue', 'payment_overdue:' || v_i.id,
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
        where p.user_id = v_uid and p.status = 'active'
          and p.sessions_used < p.total_sessions
          and (p.total_sessions - p.sessions_used) <= v_stg.package_low_threshold
    loop
      insert into public.notifications (user_id, type, ref_key, title, body, link)
      values (v_uid, 'package_low', 'package_low:' || v_p.id,
              'Paket hampir habis',
              'Paket ' || v_p.full_name || ' tersisa ' ||
                (v_p.total_sessions - v_p.sessions_used) || ' pertemuan.',
              '/students/' || v_p.student_id)
      on conflict (user_id, ref_key) do nothing;
    end loop;
  end if;
end;
$$;

-- ============================= GRANTS =============================

grant usage on schema public to anon, authenticated;
grant execute on function public.complete_session(uuid, text, int, text, text, text, text, numeric, text) to authenticated;
grant execute on function public.record_payment(uuid, uuid, text, numeric, date, text, text) to authenticated;
grant execute on function public.create_package(uuid, int, numeric, date) to authenticated;
grant execute on function public.create_invoice(uuid, text, text, numeric, date) to authenticated;
grant execute on function public.generate_monthly_invoices(int, int, text) to authenticated;
grant execute on function public.generate_schedule_occurrences(uuid, date) to authenticated;
grant execute on function public.get_dashboard_stats() to authenticated;
grant execute on function public.refresh_reminders() to authenticated;

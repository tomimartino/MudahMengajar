-- ============================================================
-- MudahMengajar — 0002_portfolio.sql
-- Portofolio guru (ala LinkedIn) + template chat ke orang tua
-- ============================================================

-- Kolom portofolio di profiles
alter table public.profiles
  add column if not exists headline text,
  add column if not exists bio text,
  add column if not exists rate numeric(12, 0) check (rate is null or rate > 0),
  add column if not exists career_start_year int check (career_start_year is null or (career_start_year >= 1950 and career_start_year <= 2100));

-- Riwayat mengajar
create table if not exists public.teaching_experiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  institution text not null,
  role text,
  start_year int not null,
  end_year int,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_teaching_experiences_user on public.teaching_experiences(user_id);

-- Prestasi
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  year int,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_achievements_user on public.achievements(user_id);

-- Template chat ke orang tua
alter table public.settings
  add column if not exists message_template_invoice text not null default
    'Halo Bapak/Ibu {{nama_wali}},' || E'\n' || E'\n' ||
    'Kami mengingatkan pembayaran bimbel {{nama_siswa}} untuk periode {{periode}}.' || E'\n' || E'\n' ||
    'Total: {{nominal}}' || E'\n' ||
    'Jatuh tempo: {{jatuh_tempo}}' || E'\n' || E'\n' ||
    'Terima kasih.',
  add column if not exists message_template_report text not null default
    'Halo Bapak/Ibu {{nama_wali}},' || E'\n' || E'\n' ||
    'Laporan belajar {{nama_siswa}} — {{tanggal}}.' || E'\n' || E'\n' ||
    'Materi: {{materi}}' || E'\n' ||
    'Nilai: {{nilai}}' || E'\n' || E'\n' ||
    'Catatan: {{catatan}}' || E'\n' ||
    'PR: {{pr}}';

-- RLS + trigger
alter table public.teaching_experiences enable row level security;
alter table public.achievements enable row level security;

drop policy if exists teaching_experiences_own on public.teaching_experiences;
create policy teaching_experiences_own on public.teaching_experiences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists achievements_own on public.achievements;
create policy achievements_own on public.achievements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists trg_teaching_experiences_updated_at on public.teaching_experiences;
create trigger trg_teaching_experiences_updated_at before update on public.teaching_experiences
  for each row execute function public.set_updated_at();
drop trigger if exists trg_achievements_updated_at on public.achievements;
create trigger trg_achievements_updated_at before update on public.achievements
  for each row execute function public.set_updated_at();

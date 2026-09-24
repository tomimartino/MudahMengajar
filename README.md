# MudahMengajar

Dashboard administrasi untuk guru bimbel dan les privat — kelola siswa, jadwal, presensi, catatan pembelajaran, paket, pembayaran, keuangan, dan laporan dalam satu tempat.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Supabase (PostgreSQL + Auth + RLS) · React Hook Form + Zod · date-fns · Recharts · Lucide

## Setup

### 1. Supabase (database)

1. Buat project di [supabase.com](https://supabase.com) (region Singapore untuk latensi terbaik).
2. Install Supabase CLI: `npm i -g supabase` (opsional untuk migrasi; bisa juga lewat SQL Editor).
3. Hubungkan project dan terapkan migrasi:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Atau tanpa CLI: buka **SQL Editor** di dashboard Supabase, jalankan isi `supabase/migrations/0001_init.sql` (membuat 14 tabel, RLS, trigger, dan 7 RPC).

4. (Opsional, hanya development) Isi data demo — Andi, Siti, Budi + jadwal, paket, tagihan, pembayaran:

```bash
npx supabase db reset
# atau jalankan supabase/seed.sql lewat SQL Editor di database development
```

Akun demo: `guru@demo.id` / `password123`.

5. **Auth settings:** di dashboard Supabase → Authentication → URL Configuration, set:
   - Site URL: `http://localhost:3000` (atau URL production)
   - Redirect URLs: tambahkan `http://localhost:3000/auth/callback`

### 2. Environment

Salin `.env.example` menjadi `.env.local` dan isi:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # jangan pernah pakai prefix NEXT_PUBLIC_
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Jalankan

```bash
npm install
npm run dev
```

Buka http://localhost:3000 → daftar akun → isi onboarding → mulai pakai.

## Skrip

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Build production |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit test (Vitest) |

## Struktur

```
app/              # App Router: (auth), onboarding, (app)/dashboard, students, schedule,
                  # sessions, attendance, payments, finance, reports, settings
components/       # UI shadcn + komponen domain (layout, dashboard, students, schedule, ...)
lib/
  actions/        # Server Actions (mutasi + validasi Zod)
  validations/    # Skema Zod per domain
  supabase/       # Klien server/browser + helper proxy
  utils/          # date (tz Asia/Jakarta), currency (Rp), whatsapp (wa.me), csv, recurrence
  reports/        # Query bersama halaman laporan & export CSV
supabase/
  migrations/     # 0001_init.sql — skema + RLS + RPC transaksional
  seed.sql        # Data demo (development only)
tests/            # Unit test Vitest
types/            # Tipe database Supabase
```

## Arsitektur singkat

- **Auth:** Supabase Auth (email+password, PKCE) + `proxy.ts` (refresh sesi + guard route) + redirect onboarding.
- **Keamanan:** RLS di semua tabel (`auth.uid() = user_id`); setiap RPC `SECURITY DEFINER` memverifikasi kepemilikan data di dalam transaksi.
- **Transaksi lintas tabel** (selesai pertemuan → session + presensi + potong paket; pembayaran → update status tagihan) berjalan sebagai Postgres RPC — atomic dan anti-race.
- **Agregat dashboard** dihitung dalam satu RPC (`get_dashboard_stats`), bukan di client.
- **Reminder** dibuat oleh RPC `refresh_reminders()` saat bell notifikasi dibuka / setelah mutasi kunci — tanpa cron di MVP.

## Deployment

1. Terapkan migrasi ke Supabase production (`supabase db push` atau SQL Editor).
2. Push repo ke GitHub → import di Vercel → isi environment variables yang sama.
3. Update Site URL & Redirect URLs Supabase ke domain Vercel.
4. Jalankan `npm run build` + `npm test` di CI; smoke test register → onboarding → dashboard.

## Catatan MVP

- Role orang tua (view-only) siap di skema (`parents`) tapi belum dibangun.
- Ekspor PDF belum tersedia — gunakan CSV (sudah tersedia di halaman Laporan).
- Seed hanya untuk development; jangan jalankan di production.

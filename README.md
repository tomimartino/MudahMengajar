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

Atau tanpa CLI: buka **SQL Editor** di dashboard Supabase dan jalankan seluruh file `supabase/migrations/` sesuai urutan nama.

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
- **Reminder** dibuat oleh RPC `refresh_reminders()` saat aplikasi dibuka, bell notifikasi dibuka, dan setelah mutasi kunci. Scheduler push yang sudah dikonfigurasi berjalan tiap menit.
- **Pengingat jadwal:** satu notifikasi saat masuk hari jadwal (00.00 menurut zona waktu akun), dan satu lagi 1 jam sebelum mulai. Notifikasi tidak dibuat ulang saat refresh; jadwal batal, dipindahkan, atau sudah dimulai dibersihkan. Jadwal dini hari dapat menerima pengingat 1 jam pada hari sebelumnya.
- **Reminder materi sebelumnya:** notifikasi terpisah 5 menit sebelum mulai. Materi/PR terakhir diambil dari siswa dan mata pelajaran yang sama, mengecualikan sesi batal dan ketidakhadiran. Detail jadwal tetap menampilkan catatan sebelumnya. Kedua pengingat memiliki toggle masing-masing. Web Push memerlukan langganan perangkat yang aktif; pengiriman dapat terlambat sekitar satu siklus pemeriksaan atau oleh perangkat.
- **Review pribadi:** Pengaturan → Review MudahMengajar. Rating 1–5 dan komentar, satu review per akun, dapat diperbarui atau dihapus. Pemilik dan petugas dukungan membaca review melalui Portal Admin → Review. Tindak lanjut dan catatan internal terpisah dari rating/komentar asli. Review tidak tampil di halaman publik.
- **Portal orang tua:** Detail Murid → Overview → Portal Orang Tua. Buat tautan pribadi untuk jadwal, presensi, materi, PR, dan tagihan satu murid. Tautan berlaku 90 hari; sesi portal maksimum 30 hari. Ganti/nonaktifkan tautan untuk mencabut akses. Token disimpan sebagai hash, sesi memakai cookie HttpOnly, dan pemeriksaan akses diulang pada setiap operasi. Murid nonaktif/diarsipkan tidak dapat memakai portal. Tautan hanya boleh dibagikan kepada wali atau murid yang berhak.
- **Materi:** menu setelah Murid, dengan Koleksi Saya (catatan dan lampiran pribadi) serta Dari Pertemuan (materi sesi mengajar). Materi pertemuan dapat disalin ke koleksi. Perubahan koleksi tidak mengubah catatan pertemuan asal.
- **Tugas/PR:** Ditugaskan dan Selesai, filter murid, tenggat, maksimal 5 lampiran per tugas (10 MB/file). PR yang dicatat saat menyelesaikan jadwal otomatis masuk ke daftar tugas. Tenggat dan teks PR disinkronkan dua arah dengan catatan pertemuan; status selesai dan lampiran tetap terjaga saat mengedit pertemuan. Guru menentukan status penyelesaian.
- **Portal PR:** orang tua dapat membaca tugas murid, tenggat, status, dan mengunduh lampiran. Semua akses diperiksa ulang berdasarkan tautan portal dan murid tujuan. Portal tetap hanya untuk membaca.
- **Lampiran:** bucket `teaching-files` bersifat privat. Akun guru hanya mengakses folder sendiri. Unduhan melalui route yang memeriksa kepemilikan atau portal murid, kemudian membuat tautan unduhan 60 detik. Berkas PDF, gambar JPEG/PNG/WebP, teks, Word, Excel, dan PowerPoint didukung.
- **Pembayaran:** pencatatan pembayaran dan pengelolaan tagihan menggunakan alur guru seperti semula. Portal menampilkan total, jumlah terbayar, dan sisa tagihan.

Uji integrasi reminder dan portal (seluruh fixture di-rollback):

```bash
supabase db query --linked --file supabase/tests/material_reminders_and_reviews.sql
supabase db query --linked --file supabase/tests/parent_portal.sql
supabase db query --linked --file supabase/tests/notification_timing.sql
supabase db query --linked --file supabase/tests/admin_erp.sql
supabase db query --linked --file supabase/tests/teaching_resources.sql
```

## Portal admin pemilik website

- Buka `/admin` atau Menu Akun → Portal Admin. Akun pemilik proyek ini adalah `tomimartino10@gmail.com`, ditetapkan setelah verifikasi identitas akun. Pendaftaran biasa tidak memberi akses admin.
- Akses ERP memerlukan Authenticator (TOTP). Pada akses pertama pilih Siapkan Verifikasi, pindai QR di aplikasi Authenticator, lalu masukkan kode 6 digit. Pemeriksaan peran aktif dan sesi MFA dilakukan ulang di server dan database pada setiap operasi admin.
- Modul: dashboard akun, akun guru (aktif/tangguhkan), review pribadi, tiket dukungan, hasil scheduler notifikasi, pengumuman (draf/terjadwal/terbit), laporan 12 bulan dan CSV, biaya website, identitas website/email dukungan/mode pemeliharaan, pengelola dan catatan perubahan admin.
- Peran Dukungan dapat membaca ringkasan akun serta mengelola review dan tiket. Pengaturan, akses admin, penangguhan, pengumuman, dan biaya website khusus pemilik. Admin tidak mendapat akses langsung ke tabel materi, murid, transaksi atau catatan mengajar guru lain.
- Mode pemeliharaan dan penangguhan diterapkan pada RLS, RPC guru, Storage, portal orang tua, dan pengiriman push. Menonaktifkan pengelola langsung mencabut akses ERP dari token yang masih aktif. Admin tidak dapat menangguhkan akun admin aktif atau mengubah akses dirinya sendiri.
- Guru membuat tiket lewat Menu Akun → Dukungan dan membaca balasan di Tiket Saya. Catatan internal hanya terlihat di portal admin. Pengumuman diterbitkan setelah konfirmasi terpisah; email penerima digunakan untuk memilih akun tertentu.
- Biaya website merupakan pencatatan manual dan terpisah dari keuangan guru. Hasil pemantauan layanan berasal dari scheduler yang benar-benar berjalan, dengan retensi 30 hari; belum ada integrasi laporan biaya otomatis Vercel/Supabase.

Uji Auth/MFA/REST/Storage menggunakan akun sementara: `node supabase/tests/admin_learning_api.mjs`. Akun, materi, tugas, tiket, dan berkas pengujian dibersihkan setelah selesai. Pada Windows, isi `QA_SUPABASE_CLI` dengan path executable CLI atau `supabase.js` sebelum menjalankan pengujian tersebut. Kredensial diambil dari `.env.local` dan tidak dicetak.

## Deployment

1. Terapkan migrasi ke Supabase production (`supabase db push` atau SQL Editor).
2. Push repo ke GitHub → import di Vercel → isi environment variables yang sama.
3. Update Site URL & Redirect URLs Supabase ke domain Vercel.
4. Jalankan `npm run build` + `npm test` di CI; smoke test register → onboarding → dashboard.

## Catatan MVP

- Portal menggunakan tautan privat per murid; akun login terpisah untuk orang tua belum disediakan.
- Invoice dapat diekspor ke PDF; laporan tersedia sebagai CSV.
- Seed hanya untuk development; jangan jalankan di production.

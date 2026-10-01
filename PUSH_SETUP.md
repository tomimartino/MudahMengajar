# Tutorial Lengkap: Mengaktifkan Notifikasi Push (Web Push)

Tutorial ini menjelaskan langkah demi langkah cara mengaktifkan notifikasi push di
MudahMengajar, mulai dari nol sampai notifikasi benar-benar muncul di HP kamu.

Semua kode yang dibutuhkan **sudah ada di repo ini** — kamu tinggal menjalankan
langkah-langkah penyiapan di bawah.

---

## 1. Cara kerja (baca dulu biar tidak bingung)

```
Setiap 5 menit:
  pg_cron (di database Supabase)
     └─> panggil Edge Function "send-push" via pg_net
             (URL & kunci dibaca dari Vault)

Edge Function "send-push":
  1. Jalankan RPC refresh_reminders_all()
       → buat ulang notifikasi (jadwal hari ini, tagihan jatuh tempo, paket habis)
         untuk SEMUA pengguna ke tabel notifications
  2. Ambil notifikasi yang belum pernah dikirim (anti-duplikat via tabel push_log)
  3. Kirim Web Push ke tiap perangkat yang berlangganan (tabel push_subscriptions)

Browser/HP pengguna:
  - service worker (public/sw.js) menerima push → tampilkan notifikasi
  - klik notifikasi → buka halaman terkait

Pengguna mengaktifkan di: Pengaturan → "Aktifkan Notifikasi"
```

Jadi ada **3 bagian yang harus disiapkan**:
1. **Database** — migrasi `0008` (tabel push, RPC, cron) + 2 secret di Vault.
2. **Edge Function** — deploy `send-push` + 3 secret VAPID.
3. **Aplikasi web** — 1 env var `NEXT_PUBLIC_VAPID_PUBLIC_KEY` di Vercel.

---

## 2. Prasyarat

- Proyek Supabase sudah ada (yang dipakai aplikasi ini).
- Node.js terinstal di komputer.
- **Supabase CLI** terinstal. Jika belum:

  ```bash
  npm install -g supabase
  # cek versi:
  supabase --version
  ```

- Website sudah di-deploy ke Vercel (atau akan di-deploy). Web push **wajib HTTPS**
  — Vercel sudah menyediakan, dan `localhost` juga aman untuk uji coba.

---

## 3. Langkah 1 — Generate kunci VAPID (sekali saja)

Kunci VAPID adalah identitas pengirim push. Jalankan di terminal:

```bash
npx web-push generate-vapid-keys --json
```

Hasilnya kira-kira seperti ini (contoh, jangan dipakai):

```json
{
  "publicKey": "BC8ZWiBvHqk3f...-q5KJhYx8",
  "privateKey": "lW9mP2nR...8TvE7sA"
}
```

- **publicKey** → masuk ke aplikasi web (boleh dilihat browser).
- **privateKey** → masuk ke Edge Function (RAHASIA, jangan pernah taruh di kode
  frontend atau variabel `NEXT_PUBLIC_*`).

Simpan keduanya di tempat aman (mis. password manager).

---

## 4. Langkah 2 — Env var di aplikasi web (Vercel)

1. Buka dashboard Vercel → proyek MudahMengajar → **Settings → Environment Variables**.
2. Tambah variabel baru:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | publicKey dari Langkah 1 |

3. Klik **Save**, lalu **Redeploy** (deploy ulang) aplikasi.
4. Untuk uji coba lokal, tambahkan juga di file `.env.local`:

   ```bash
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=publicKey-kamu
   ```

> Hanya kunci **publik** yang boleh pakai prefix `NEXT_PUBLIC_`. Kunci privat nanti
> masuk ke Supabase, bukan ke Vercel.

---

## 5. Langkah 3 — Terapkan migrasi 0008 ke database

Migrasi ini membuat tabel `push_subscriptions`, `push_log`, RPC
`refresh_reminders_for_user` / `refresh_reminders_all`, dan menjadwalkan cron
tiap 5 menit.

### Cara A: lewat CLI (disarankan)

```bash
# masuk ke folder proyek MudahMengajar
cd C:\MudahMengajar

# login & hubungkan ke proyek Supabase kamu
supabase login
supabase link --project-ref REF_PROYEK_KAMU

# terapkan semua migrasi
supabase db push
```

`REF_PROYEK_KAMU` bisa dilihat di dashboard Supabase (URL-nya seperti
`https://abcxyz.supabase.co` → ref-nya `abcxyz`), atau via `supabase projects list`.

### Cara B: lewat SQL Editor

Buka [Supabase Dashboard](https://supabase.com/dashboard) → proyek kamu →
**SQL Editor** → tempel seluruh isi file
[`supabase/migrations/0008_push_notifications.sql`](supabase/migrations/0008_push_notifications.sql)
→ **Run**.

### Pastikan ekstensi aktif

Migrasi butuh `pg_cron` dan `pg_net`. Keduanya tersedia di Supabase, tapi jika
`supabase db push` / SQL Editor error, cek:
**Dashboard → Database → Extensions** → cari `pg_cron` dan `pg_net` → pastikan aktif.

### Verifikasi

Jalankan di SQL Editor:

```sql
select jobid, jobname, schedule, active from cron.job
where jobname = 'send-push-notifications';
```

Jika muncul 1 baris dengan `schedule = */5 * * * *` dan `active = true` → berhasil.

---

## 6. Langkah 4 — Deploy Edge Function `send-push`

Masih dari folder proyek (folder yang berisi `supabase/functions/send-push`):

```bash
# deploy function (tanpa verifikasi JWT karena dipanggil pg_cron,
# keamanannya dijaga header Authorization di dalam kode function)
supabase functions deploy send-push --no-verify-jwt

# set secret VAPID (public + private + email pemilik kunci)
supabase secrets set VAPID_PUBLIC_KEY=PUBLIC_KEY_KAMU
supabase secrets set VAPID_PRIVATE_KEY=PRIVATE_KEY_KAMU
supabase secrets set VAPID_SUBJECT=mailto:emailkamu@gmail.com
```

> `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` **otomatis tersedia** di dalam
> Edge Function — tidak perlu di-set manual.

**Verifikasi secret terpasang:**

```bash
supabase secrets list
```

Harus terlihat `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

---

## 7. Langkah 5 — Buat 2 secret di Vault (untuk cron)

Cron butuh tahu URL Edge Function dan kunci untuk memanggilnya. Keduanya disimpan
terenkripsi di **Vault**.

Buka **SQL Editor** di dashboard Supabase, lalu jalankan (ganti `abcxyz` dengan
ref proyek kamu dan `SERVICE_ROLE_KEY` dengan kunci asli):

```sql
-- URL Edge Function
select vault.create_secret('https://abcxyz.supabase.co/functions/v1/send-push', 'push_function_url');

-- Service role key (Dashboard → Project Settings → API → service_role key)
select vault.create_secret('PASTE_SERVICE_ROLE_KEY_DI_SINI', 'push_service_key');
```

**Verifikasi:**

```sql
select name, decrypted_secret from vault.decrypted_secrets
where name in ('push_function_url', 'push_service_key');
```

> Service role key adalah kunci paling kuat — ia melewati semua RLS. Jangan pernah
> taruh di kode frontend atau kirim ke orang lain.

---

## 8. Langkah 6 — Uji Edge Function langsung

Dari terminal (Windows PowerShell / CMD):

```bash
curl -X POST "https://abcxyz.supabase.co/functions/v1/send-push" -H "Authorization: Bearer SERVICE_ROLE_KEY_KAMU"
```

Respons yang sehat (belum ada notifikasi):

```json
{ "processed": 0, "sent": 0, "skipped": 0 }
```

Respons `{"error":"Unauthorized"}` → service key salah.
Respons `{"error":"VAPID keys are not configured"}` → secret VAPID belum terpasang.

---

## 9. Langkah 7 — Verifikasi cron berjalan

Cron jalan tiap 5 menit. Setelah menunggu ±6 menit, cek di SQL Editor:

```sql
select j.jobname, d.status, d.return_message, d.start_time
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where j.jobname = 'send-push-notifications'
order by d.start_time desc
limit 5;
```

- `status = succeeded` → semua terhubung dengan benar.
- `status = failed` → baca `return_message`, lalu lihat bagian Troubleshooting.

---

## 10. Langkah 8 — Aktifkan dari sisi pengguna (per perangkat)

1. Buka aplikasi → **Pengaturan** → bagian **"Notifikasi di HP"** → klik
   **"Aktifkan Notifikasi"**.
2. Browser akan meminta izin notifikasi → klik **Izinkan/Allow**.
3. Status berubah menjadi **"Aktif di perangkat ini"** (badge hijau).

Cek data masuk ke database (SQL Editor):

```sql
select count(*) from push_subscriptions;
```

**Catatan per perangkat:**
- **Android** (Chrome/Edge/Firefox) & **Desktop** → langsung jalan.
- **iPhone/iPad** → web push hanya jalan jika aplikasi di-install sebagai PWA:
  buka website di Safari → tombol **Bagikan** → **Tambahkan ke Layar Utama**
  (Add to Home Screen) → buka aplikasi dari ikonnya → baru aktifkan notifikasi.
  (Aplikasi ini sudah punya manifest PWA, jadi siap.)

---

## 11. Langkah 9 — Uji end-to-end (opsional tapi disarankan)

1. Buat jadwal pertemuan **hari ini** untuk seorang siswa.
2. Buka lonceng notifikasi (bell) di aplikasi — ini memanggil `refresh_reminders()`.
3. Tunggu maksimal 5 menit (cron berikutnya) → notifikasi push muncul di HP:
   *"Jadwal hari ini — [Nama siswa] memiliki jadwal pukul ..."*
4. Klik notifikasi → aplikasi terbuka di halaman terkait.

---

## 12. Troubleshooting

| Gejala | Kemungkinan penyebab | Solusi |
|---|---|---|
| `cron.job_run_details` = failed | Vault secret belum dibuat / salah | Cek Langkah 5, pastikan nama persis `push_function_url` & `push_service_key` |
| Edge Function `401 Unauthorized` | Service key salah / kunci dirotasi | Pastikan `Authorization: Bearer <service_role_key>` sama dengan kunci aktif di Dashboard → API |
| `VAPID keys are not configured` | Secret VAPID belum di-set | Ulangi Langkah 4 (`supabase secrets set ...`) |
| Notifikasi tidak muncul di HP | Perangkat belum aktifkan push | Pengaturan → Aktifkan Notifikasi; cek `push_subscriptions` ada barisnya |
| Notifikasi tidak muncul di iPhone | Belum di-install sebagai PWA | Bagikan → Tambahkan ke Layar Utama → buka dari ikon |
| Bell notifikasi tidak terisi | `refresh_reminders_all` gagal | Cek log cron (Langkah 9); toggle notifikasi di Pengaturan harus aktif |
| Notifikasi sama terkirim terus | Seharusnya tidak — ada anti-duplikat | Tabel `push_log` mencegah kirim ulang per `ref_key` |
| Izin ditolak permanen | User menolak izin | User harus mengubah izin notifikasi di pengaturan browser (tidak bisa dipaksa dari web) |
| Cron tetap gagal setelah semuanya benar | Job terjadwal sebelum secret dibuat (gagal di run awal) | Cukup tunggu run berikutnya; run lama yang gagal tidak masalah |

### Catatan pengembangan lokal

`supabase start` (stack lokal) **tidak menjalankan pg_cron** secara default, jadi
alur kirim otomatis tiap 5 menit hanya berjalan di **proyek hosted**. Untuk uji
lokal, panggil Edge Function secara manual dengan `curl` (Langkah 6) setelah
menjalankan `supabase functions serve send-push`.

---

## 13. Ringkasan ceklis

- [ ] Generate VAPID keys (`npx web-push generate-vapid-keys --json`)
- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY` di Vercel + redeploy
- [ ] Migrasi 0008 diterapkan (`supabase db push` atau SQL Editor)
- [ ] Ekstensi `pg_cron` & `pg_net` aktif
- [ ] `supabase functions deploy send-push --no-verify-jwt`
- [ ] `supabase secrets set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT`
- [ ] 2 secret Vault: `push_function_url` & `push_service_key`
- [ ] `curl` Edge Function → respons 200
- [ ] `cron.job_run_details` → `succeeded`
- [ ] Pengaturan → Aktifkan Notifikasi → badge hijau
- [ ] Notifikasi muncul di HP dalam ≤5 menit

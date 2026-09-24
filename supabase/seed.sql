-- ============================================================
-- MudahMengajar — seed.sql (HANYA untuk development)
-- Akun demo: guru@demo.id / password123
-- ============================================================

-- Guru demo (trigger handle_new_user otomatis membuat profiles + settings)
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'guru@demo.id',
   crypt('password123', gen_salt('bf')),
   now(),
   '{"provider":"email","providers":["email"]}',
   '{}',
   now(), now())
on conflict (id) do nothing;

insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   '{"sub":"00000000-0000-0000-0000-000000000001","email":"guru@demo.id"}',
   'email',
   '00000000-0000-0000-0000-000000000001',
   now(), now(), now())
on conflict (id) do nothing;

update public.profiles
set full_name = 'Budi Guru',
    whatsapp = '081234567890',
    business_name = 'Bimbel Cerdas',
    address = 'Jl. Pendidikan No. 12, Jakarta',
    teaching_levels = array['SD', 'SMP', 'SMA'],
    timezone = 'Asia/Jakarta',
    onboarding_completed = true,
    headline = 'Guru Matematika & IPA — SD sampai SMA',
    bio = 'Membantu siswa memahami konsep dengan cara yang menyenangkan. Fokus pada persiapan ujian dan olimpiade.',
    rate = 75000,
    career_start_year = 2018
where id = '00000000-0000-0000-0000-000000000001';

-- Portofolio: riwayat mengajar & prestasi
insert into public.teaching_experiences (id, user_id, institution, role, start_year, end_year, description) values
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'Bimbel Cerdas', 'Guru Matematika', 2020, null, 'Mengajar kelas 6 SD sampai 12 SMA'),
  ('a1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'SMP Negeri 2 Jakarta', 'Guru honorer', 2018, 2020, 'Mengajar matematika kelas 7-9')
on conflict do nothing;

insert into public.achievements (id, user_id, title, year, description) values
  ('b1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'Juara 1 Lomba Mengajar Kreatif', 2022, 'Lomba mengajar tingkat kota'),
  ('b1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'Pembimbing Olimpiade Matematika', 2023, 'Membimbing 3 siswa lolos tingkat provinsi')
on conflict do nothing;

-- Mata pelajaran
insert into public.subjects (id, user_id, name) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Matematika'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'IPA'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Bahasa Inggris')
on conflict do nothing;

-- Orang tua / wali
insert into public.parents (id, user_id, name, whatsapp) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Bapak Hendra', '081298765432'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Ibu Maya', '081377788899'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Bapak Santoso', '081255544433')
on conflict do nothing;

-- Siswa
insert into public.students (id, user_id, parent_id, full_name, gender, birth_date, school_name, school_level, grade_level, phone, learning_mode, billing_type, per_session_rate, monthly_fee, monthly_due_day, status, notes) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'Andi Pratama', 'L', '2012-03-14', 'SMP Negeri 1 Jakarta', 'SMP', '8', '081200011122', 'offline', 'package', null, null, null, 'active', 'Fokus persiapan olimpiade'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
   'Siti Rahma', 'P', '2014-07-22', 'SD Ceria', 'SD', '6', '081200033344', 'online', 'monthly', null, 500000, 10, 'active', null),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003',
   'Budi Santoso', 'L', '2009-01-05', 'SMA Harapan Bangsa', 'SMA', '10', '081200055566', 'hybrid', 'per_session', 75000, null, null, 'active', null)
on conflict do nothing;

insert into public.student_subjects (user_id, student_id, subject_id) values
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003')
on conflict do nothing;

-- Tagihan: beragam status (overdue, jatuh tempo, lunas, sebagian)
insert into public.invoices (id, user_id, student_id, invoice_number, type, period_label, amount, due_date, status) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
   'INV-2026-0001', 'package', 'Paket 12x Pertemuan', 1200000, current_date - 10, 'paid'),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002',
   'INV-2026-0002', 'monthly', 'September 2026', 500000, current_date - 2, 'unpaid'),
  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002',
   'INV-2026-0003', 'monthly', 'Agustus 2026', 500000, current_date - 32, 'paid'),
  ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003',
   'INV-2026-0004', 'per_session', '4x Pertemuan', 300000, current_date + 1, 'partial')
on conflict do nothing;

-- Paket Andi: 12 pertemuan, terpakai 8 (sisa 4) — sesuai 8 sesi "hadir"
insert into public.student_packages (id, user_id, student_id, invoice_id, total_sessions, sessions_used, price, start_date, status) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000001', 12, 8, 1200000, current_date - 40, 'active')
on conflict do nothing;

-- Pembayaran (konsisten dengan status tagihan)
insert into public.payments (id, user_id, student_id, invoice_id, type, amount, payment_date, method, notes) values
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000001', 'package', 1200000, current_date - 9, 'bank_transfer', 'Pelunasan paket'),
  ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002',
   '40000000-0000-0000-0000-000000000003', 'monthly', 500000, current_date - 25, 'cash', null),
  ('60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003',
   '40000000-0000-0000-0000-000000000004', 'per_session', 150000, current_date - 3, 'ewallet', 'DP 2 pertemuan'),
  ('60000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
   null, 'other', 100000, current_date - 5, 'cash', 'Pendaftaran')
on conflict do nothing;

-- Pengeluaran
insert into public.expenses (id, user_id, expense_date, category, description, amount, notes) values
  ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', current_date - 8, 'internet', 'Paket internet bulanan', 350000, null),
  ('70000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', current_date - 6, 'printing', 'Print modul latihan', 85000, 'Modul 30 halaman x3'),
  ('70000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', current_date - 2, 'transport', 'Bensin ke rumah siswa', 50000, null)
on conflict do nothing;

-- Jadwal: 2 hari ini, 1 sedang berlangsung, + master berulang mingguan
insert into public.schedules (id, user_id, student_id, subject_id, start_at, end_at, learning_mode, location, status) values
  ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   (((now() at time zone 'Asia/Jakarta')::date + time '16:00') at time zone 'Asia/Jakarta'),
   (((now() at time zone 'Asia/Jakarta')::date + time '17:30') at time zone 'Asia/Jakarta'),
   'offline', 'Rumah siswa', 'scheduled'),
  ('80000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000002',
   (((now() at time zone 'Asia/Jakarta')::date + time '18:30') at time zone 'Asia/Jakarta'),
   (((now() at time zone 'Asia/Jakarta')::date + time '20:00') at time zone 'Asia/Jakarta'),
   'online', 'Zoom: https://zoom.us/j/demo', 'scheduled'),
  ('80000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000001',
   (((now() at time zone 'Asia/Jakarta')::date + 1 + time '15:00') at time zone 'Asia/Jakarta'),
   (((now() at time zone 'Asia/Jakarta')::date + 1 + time '16:30') at time zone 'Asia/Jakarta'),
   'hybrid', 'Rumah siswa / Zoom', 'scheduled')
on conflict do nothing;

-- Master berulang: Andi Matematika tiap minggu (start 7 hari lagi, 16:00)
insert into public.schedules (id, user_id, student_id, subject_id, start_at, end_at, learning_mode, location, status, recurrence_rule) values
  ('80000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   (((now() at time zone 'Asia/Jakarta')::date + 7 + time '16:00') at time zone 'Asia/Jakarta'),
   (((now() at time zone 'Asia/Jakarta')::date + 7 + time '17:30') at time zone 'Asia/Jakarta'),
   'offline', 'Rumah siswa', 'scheduled',
   '{"frequency":"weekly","interval":1,"days":[]}')
on conflict do nothing;

-- Occurrence minggu berikutnya (RPC butuh konteks auth, jadi insert langsung di seed)
insert into public.schedules (user_id, student_id, subject_id, start_at, end_at, learning_mode, location, status, recurrence_id) values
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   (((now() at time zone 'Asia/Jakarta')::date + 14 + time '16:00') at time zone 'Asia/Jakarta'),
   (((now() at time zone 'Asia/Jakarta')::date + 14 + time '17:30') at time zone 'Asia/Jakarta'),
   'offline', 'Rumah siswa', 'scheduled', '80000000-0000-0000-0000-000000000010'),
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   (((now() at time zone 'Asia/Jakarta')::date + 21 + time '16:00') at time zone 'Asia/Jakarta'),
   (((now() at time zone 'Asia/Jakarta')::date + 21 + time '17:30') at time zone 'Asia/Jakarta'),
   'offline', 'Rumah siswa', 'scheduled', '80000000-0000-0000-0000-000000000010')
on conflict do nothing;

-- Riwayat pertemuan Andi: 8 hadir (paket terpotong), 1 izin, 1 sakit
insert into public.sessions (id, user_id, student_id, subject_id, session_date, started_at, ended_at, duration_minutes, material, learning_notes, homework, score, progress_notes) values
  ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   (now() at time zone 'Asia/Jakarta')::date - 27, now() - interval '27 days', now() - interval '27 days' + interval '90 minutes', 90,
   'Persamaan Linear Dua Variabel', 'Cukup paham, perlu latihan soal cerita', 'Latihan 3 soal cerita', 78, 'Perkembangan baik'),
  ('90000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   (now() at time zone 'Asia/Jakarta')::date - 20, now() - interval '20 days', now() - interval '20 days' + interval '90 minutes', 90,
   'Gradien dan Persamaan Garis', 'Sudah lancar', 'Latihan gradien', 85, null),
  ('90000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   (now() at time zone 'Asia/Jakarta')::date - 13, now() - interval '13 days', now() - interval '13 days' + interval '90 minutes', 90,
   'Sistem Persamaan', 'Butuh pengulangan metode eliminasi', 'Latihan eliminasi 5 soal', 72, 'Perlu pendampingan'),
  ('90000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   (now() at time zone 'Asia/Jakarta')::date - 6, now() - interval '6 days', now() - interval '6 days' + interval '90 minutes', 90,
   'Fungsi Linear', 'Paham konsep dasar', null, 80, null),
  ('90000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   (now() at time zone 'Asia/Jakarta')::date - 5, now() - interval '5 days', now() - interval '5 days' + interval '90 minutes', 90,
   'Relasi dan Fungsi', 'Cukup', 'Latihan relasi', 75, null),
  ('90000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   (now() at time zone 'Asia/Jakarta')::date - 4, now() - interval '4 days', now() - interval '4 days' + interval '90 minutes', 90,
   'Pola Bilangan', 'Bagus', null, 88, null),
  ('90000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   (now() at time zone 'Asia/Jakarta')::date - 3, now() - interval '3 days', now() - interval '3 days' + interval '90 minutes', 90,
   'Barisan Aritmetika', 'Paham rumus', 'Latihan barisan 4 soal', 82, null),
  ('90000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   (now() at time zone 'Asia/Jakarta')::date - 2, now() - interval '2 days', now() - interval '2 days' + interval '90 minutes', 90,
   'Deret Aritmetika', 'Perlu latihan soal campuran', 'Latihan 5 soal', 70, null),
  ('90000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   (now() at time zone 'Asia/Jakarta')::date - 1, now() - interval '1 days', now() - interval '1 days' + interval '90 minutes', 90,
   null, 'Izin karena sakit', null, null, null),
  ('90000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   (now() at time zone 'Asia/Jakarta')::date - 1, now() - interval '1 days', now() - interval '1 days' + interval '90 minutes', 90,
   null, 'Sakit (demam)', null, null, null)
on conflict do nothing;

insert into public.attendance (user_id, session_id, student_id, status) values
  ('00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'hadir'),
  ('00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'hadir'),
  ('00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'hadir'),
  ('00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'hadir'),
  ('00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', 'hadir'),
  ('00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000001', 'hadir'),
  ('00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000001', 'hadir'),
  ('00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000001', 'hadir'),
  ('00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000001', 'izin'),
  ('00000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000001', 'sakit')
on conflict do nothing;

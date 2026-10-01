"use server";

import { addDays, addMinutes, format, getISODay, parse } from "date-fns";
import { id } from "date-fns/locale";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { actionError, fail, ok } from "@/lib/actions/helpers";
import { studentSchema } from "@/lib/validations/student";
import { parseAmount } from "@/lib/utils/currency";
import { DELETE_STUDENT_CONFIRMATION } from "@/lib/constants";
import type { ActionResult } from "@/lib/actions/helpers";

function clean(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

async function upsertParent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  name: string,
  whatsapp: string
): Promise<string | null> {
  if (!name.trim()) return null;
  const { data, error } = await supabase
    .from("parents")
    .upsert(
      { user_id: userId, name: name.trim(), whatsapp: whatsapp.trim() },
      { onConflict: "user_id,whatsapp" }
    )
    .select("id")
    .single();
  if (error) throw new Error("Gagal menyimpan data wali: " + error.message);
  return data.id;
}

async function replaceSubjects(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  studentId: string,
  subjectIds: string[]
): Promise<void> {
  await supabase.from("student_subjects").delete().eq("student_id", studentId);
  const { error } = await supabase.from("student_subjects").insert(
    subjectIds.map((subjectId) => ({
      user_id: userId,
      student_id: studentId,
      subject_id: subjectId,
    }))
  );
  if (error) throw new Error("Gagal menyimpan mata pelajaran: " + error.message);
}

/** Jatuh tempo bulan ini dengan clamp hari (mis. due day 31 → 30 di bulan April). */
function monthlyDueDate(dueDay: number): string {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const day = Math.min(dueDay, lastDay);
  return format(new Date(now.getFullYear(), now.getMonth(), day), "yyyy-MM-dd");
}

/**
 * Tagihan otomatis sesuai sistem pembayaran siswa.
 * package → RPC create_package (paket + invoice); monthly/per_session → RPC create_invoice.
 * Tenggat bayar paket mengikuti hari terakhir jadwal (dueDate).
 * Mengembalikan invoice_id (null jika tidak membuat tagihan).
 */
async function createBillingInvoice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  d: ReturnType<typeof studentSchema.parse>,
  studentId: string,
  dueDate?: string
): Promise<string | null> {
  if (d.billing_type === "package") {
    const startDate =
      dueDate || d.package_start_date || format(new Date(), "yyyy-MM-dd");
    const { data, error } = await supabase.rpc("create_package", {
      p_student_id: studentId,
      p_total_sessions: Number(d.package_sessions),
      p_per_session_rate: parseAmount(d.package_per_session_rate),
      p_price: parseAmount(d.package_price),
      p_start_date: startDate,
    });
    if (error) throw error;
    const result = data as unknown as { invoice_id: string | null };
    return result.invoice_id ?? null;
  }

  if (d.billing_type === "monthly") {
    const { data, error } = await supabase.rpc("create_invoice", {
      p_student_id: studentId,
      p_type: "monthly",
      p_period_label: format(new Date(), "MMMM yyyy", { locale: id }),
      p_amount: parseAmount(d.monthly_fee),
      p_due_date: monthlyDueDate(Number(d.monthly_due_day)),
    });
    if (error) throw error;
    return (data as unknown as { invoice_id: string }).invoice_id;
  }

  return null;
}

/** Jatuh tempo berikutnya (due day di-clamp ke panjang bulan). */
function nextMonthlyDueDate(dueDay: number, tz: string): Date {
  const now = toZonedTime(new Date(), tz);
  const tomorrow = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 1);
  const mk = (y: number, m: number) => {
    const last = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(dueDay, last));
  };
  const thisMonth = mk(now.getFullYear(), now.getMonth());
  return thisMonth >= tomorrow
    ? thisMonth
    : mk(now.getFullYear(), now.getMonth() + 1);
}

/**
 * Hitung tanggal pertemuan dari pola jadwal (hari + jam), banyaknya mengikuti
 * sistem pembayaran. package → sebanyak jumlah pertemuan paket; monthly → pada
 * hari terpilih sampai tanggal jatuh tempo berikutnya. Dimulai dari
 * schedule_start_date bila diisi (boleh lampau); jika kosong, mulai hari ini
 * bila jam mulai belum lewat.
 */
async function computeScheduleDates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  d: ReturnType<typeof studentSchema.parse>
): Promise<{
  dates: Array<{ date: string; time: string }>;
  tz: string;
  durationMinutes: number;
}> {
  const timeByDay = new Map(d.schedule_times.map((t) => [t.day, t.start_time]));
  if (timeByDay.size === 0) {
    return { dates: [], tz: "Asia/Jakarta", durationMinutes: 90 };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .single();
  const tz = profile?.timezone ?? "Asia/Jakarta";

  // Durasi pertemuan mengikuti pengaturan guru
  const { data: settings } = await supabase
    .from("settings")
    .select("default_duration_minutes")
    .eq("user_id", userId)
    .single();
  const durationMinutes = settings?.default_duration_minutes ?? 90;

  const dates: Array<{ date: string; time: string }> = [];
  const now = toZonedTime(new Date(), tz);

  let cursor: Date;
  if (d.schedule_start_date) {
    // Mulai dari tanggal yang dipilih — boleh lampau; pertemuan lewat ditandai completed.
    cursor = parse(d.schedule_start_date, "yyyy-MM-dd", new Date());
  } else {
    // Perilaku lama: sertakan hari ini hanya jika hari terpilih dan jam mulai belum lewat.
    const isoDay = getISODay(now);
    const todayIncluded = timeByDay.has(isoDay) && format(now, "HH:mm") < timeByDay.get(isoDay)!;
    cursor = todayIncluded ? now : addDays(now, 1);
  }

  if (d.billing_type === "package") {
    const total = Number(d.package_sessions);
    while (dates.length < total) {
      const isoDay = getISODay(cursor);
      const time = timeByDay.get(isoDay);
      if (time) {
        dates.push({ date: format(cursor, "yyyy-MM-dd"), time });
      }
      cursor = addDays(cursor, 1);
    }
  } else if (d.billing_type === "monthly") {
    const due = toZonedTime(nextMonthlyDueDate(Number(d.monthly_due_day), tz), tz);
    const dueKey = format(due, "yyyy-MM-dd");
    // Maksimal 2 bulan iterasi sebagai pengaman
    let guard = 0;
    while (format(cursor, "yyyy-MM-dd") <= dueKey && guard < 90) {
      const isoDay = getISODay(cursor);
      const time = timeByDay.get(isoDay);
      if (time) {
        dates.push({ date: format(cursor, "yyyy-MM-dd"), time });
      }
      cursor = addDays(cursor, 1);
      guard += 1;
    }
  }

  return { dates, tz, durationMinutes };
}

/**
 * Jadwal (opsional): buat baris schedules dari pola jadwal. Tanpa recurrence_rule.
 * computed dapat dipakai ulang dari computeScheduleDates agar tidak dihitung dua kali.
 */
async function createInitialSchedule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  studentId: string,
  d: ReturnType<typeof studentSchema.parse>,
  computed?: Awaited<ReturnType<typeof computeScheduleDates>>
): Promise<void> {
  const { dates, tz, durationMinutes } =
    computed ?? (await computeScheduleDates(supabase, userId, d));
  if (dates.length === 0) return;

  const rows = dates.map(({ date, time }) => {
    const startLocal = parse(`${date} ${time}`, "yyyy-MM-dd HH:mm", new Date());
    const endLocal = addMinutes(startLocal, durationMinutes);
    const ended = fromZonedTime(endLocal, tz) <= new Date();
    return {
      user_id: userId,
      student_id: studentId,
      subject_id: d.subject_ids[0]!,
      start_at: fromZonedTime(startLocal, tz).toISOString(),
      end_at: fromZonedTime(endLocal, tz).toISOString(),
      learning_mode: d.learning_mode,
      location: clean(d.schedule_location),
      status: ended ? "completed" : "scheduled",
    };
  });

  const { error } = await supabase.from("schedules").insert(rows);
  if (error) throw new Error("Gagal membuat jadwal: " + error.message);
}

export async function createStudentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tidak terautentikasi.");

  try {
    const parentId = await upsertParent(supabase, user.id, d.parent_name, d.parent_whatsapp);

    const { data: student, error } = await supabase
      .from("students")
      .insert({
        user_id: user.id,
        parent_id: parentId,
        full_name: d.full_name.trim(),
        gender: d.gender ?? null,
        birth_date: clean(d.birth_date),
        school_name: clean(d.school_name),
        school_level: d.school_level,
        grade_level: d.grade_level,
        phone: clean(d.phone),
        address: clean(d.address),
        notes: clean(d.notes),
        learning_mode: d.learning_mode,
        billing_type: d.billing_type,
        per_session_rate:
          d.billing_type === "per_session" ? String(parseAmount(d.per_session_rate)) : null,
        monthly_fee: d.billing_type === "monthly" ? String(parseAmount(d.monthly_fee)) : null,
        monthly_due_day: d.billing_type === "monthly" ? Number(d.monthly_due_day) : null,
        status: d.status,
      })
      .select("id")
      .single();
    if (error) throw error;

    await replaceSubjects(supabase, user.id, student.id, d.subject_ids);

    // Jadwal (opsional) dihitung dulu — hari terakhir jadwal menjadi tenggat bayar paket.
    const schedule = await computeScheduleDates(supabase, user.id, d);
    const dueDate =
      schedule.dates.length > 0
        ? schedule.dates[schedule.dates.length - 1].date
        : "";

    // Tagihan otomatis sesuai sistem pembayaran
    await createBillingInvoice(supabase, d, student.id, dueDate);

    // Jadwal (opsional) — banyaknya mengikuti sistem pembayaran
    await createInitialSchedule(supabase, user.id, student.id, d, schedule);

    revalidatePath("/", "layout");
    return ok({ id: student.id });
  } catch (e) {
    return fail(actionError(e));
  }
}

/** Pola jadwal mendatang siswa: hari → jam mulai, tanggal mulai, dan lokasi. */
async function upcomingScheduleSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  studentId: string,
  tz: string
): Promise<{
  byDay: Map<number, string>;
  firstDate: string | null;
  location: string | null;
}> {
  const { data: scheds } = await supabase
    .from("schedules")
    .select("start_at, location")
    .eq("user_id", userId)
    .eq("student_id", studentId)
    .eq("status", "scheduled")
    .order("start_at");
  const byDay = new Map<number, string>();
  let firstDate: string | null = null;
  let location: string | null = null;
  for (const s of scheds ?? []) {
    const local = toZonedTime(s.start_at, tz);
    const day = getISODay(local);
    if (!byDay.has(day)) byDay.set(day, format(local, "HH:mm"));
    if (firstDate === null) firstDate = format(local, "yyyy-MM-dd");
    if (location === null) location = s.location;
  }
  return { byDay, firstDate, location };
}

export async function updateStudentAction(
  studentId: string,
  input: unknown
): Promise<ActionResult> {
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tidak terautentikasi.");

  try {
    const parentId = await upsertParent(supabase, user.id, d.parent_name, d.parent_whatsapp);

    const { error } = await supabase
      .from("students")
      .update({
        parent_id: parentId,
        full_name: d.full_name.trim(),
        gender: d.gender ?? null,
        birth_date: clean(d.birth_date),
        school_name: clean(d.school_name),
        school_level: d.school_level,
        grade_level: d.grade_level,
        phone: clean(d.phone),
        address: clean(d.address),
        notes: clean(d.notes),
        learning_mode: d.learning_mode,
        billing_type: d.billing_type,
        per_session_rate:
          d.billing_type === "per_session" ? String(parseAmount(d.per_session_rate)) : null,
        monthly_fee: d.billing_type === "monthly" ? String(parseAmount(d.monthly_fee)) : null,
        monthly_due_day: d.billing_type === "monthly" ? Number(d.monthly_due_day) : null,
        status: d.status,
      })
      .eq("id", studentId);
    if (error) throw error;

    await replaceSubjects(supabase, user.id, studentId, d.subject_ids);

    // Jadwal: ganti jadwal mendatang hanya jika pola hari/jam, tanggal mulai, atau lokasi berubah.
    if (d.schedule_times.length > 0) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("timezone")
        .eq("id", user.id)
        .single();
      const tz = profile?.timezone ?? "Asia/Jakarta";
      const snap = await upcomingScheduleSnapshot(supabase, user.id, studentId, tz);

      const sameTimes =
        snap.byDay.size === d.schedule_times.length &&
        d.schedule_times.every((t) => snap.byDay.get(t.day) === t.start_time);
      const sameStart =
        !d.schedule_start_date ||
        snap.firstDate === null ||
        snap.firstDate === d.schedule_start_date;
      const sameLocation = clean(d.schedule_location) === snap.location;

      if (!(sameTimes && sameStart && sameLocation)) {
        const hasValidCount =
          d.billing_type !== "package" || Number(d.package_sessions) > 0;
        if (hasValidCount) {
          await supabase
            .from("schedules")
            .delete()
            .eq("student_id", studentId)
            .eq("status", "scheduled");
          await createInitialSchedule(supabase, user.id, studentId, d);
        }
      }
    }

    revalidatePath("/", "layout");
    return ok();
  } catch (e) {
    return fail(actionError(e));
  }
}

export async function deleteStudentAction(
  studentId: string,
  confirmation: string
): Promise<ActionResult> {
  if (confirmation !== DELETE_STUDENT_CONFIRMATION) {
    return fail('Ketik "HAPUS MURID" untuk mengonfirmasi.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tidak terautentikasi.");

  // Pastikan siswa milik pengguna ini (baris milik user lain tidak terlihat karena RLS).
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return fail("Siswa tidak ditemukan.");

  // Hapus total: presensi → pertemuan → jadwal → pembayaran → siswa
  // (student_subjects, paket, dan tagihan terhapus otomatis via ON DELETE CASCADE)
  await supabase.from("attendance").delete().eq("student_id", studentId);
  await supabase.from("sessions").delete().eq("student_id", studentId);
  await supabase.from("schedules").delete().eq("student_id", studentId);
  await supabase.from("payments").delete().eq("student_id", studentId);

  const { error } = await supabase.from("students").delete().eq("id", studentId);
  if (error) return fail(actionError(error));

  revalidatePath("/", "layout");
  return ok();
}

export async function setStudentStatusAction(
  studentId: string,
  status: "active" | "inactive"
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({ status })
    .eq("id", studentId);
  if (error) return fail(actionError(error));

  // Saat dinonaktifkan, hapus jadwal siswa dari kalender.
  if (status === "inactive") {
    await supabase
      .from("schedules")
      .delete()
      .eq("student_id", studentId)
      .eq("status", "scheduled");
  }

  revalidatePath("/", "layout");
  return ok();
}

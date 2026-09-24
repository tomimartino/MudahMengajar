"use server";

import { addDays, addMinutes, format, getISODay, parse } from "date-fns";
import { id } from "date-fns/locale";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { actionError, fail, ok } from "@/lib/actions/helpers";
import { studentSchema } from "@/lib/validations/student";
import { parseAmount } from "@/lib/utils/currency";
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
 * Mengembalikan invoice_id (null jika tidak membuat tagihan).
 */
async function createBillingInvoice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  d: ReturnType<typeof studentSchema.parse>,
  studentId: string
): Promise<string | null> {
  if (d.billing_type === "package") {
    const { data, error } = await supabase.rpc("create_package", {
      p_student_id: studentId,
      p_total_sessions: Number(d.package_sessions),
      p_price: parseAmount(d.package_price),
      p_start_date: d.package_start_date,
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
 * Jadwal (opsional): guru memilih hari + jam, banyaknya mengikuti sistem pembayaran.
 * package → sebanyak jumlah pertemuan paket; monthly → pada hari terpilih
 * sampai tanggal jatuh tempo berikutnya. Mulai hari ini bila jam mulai belum
 * lewat, tanpa recurrence_rule.
 */
async function createInitialSchedule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  studentId: string,
  d: ReturnType<typeof studentSchema.parse>
): Promise<void> {
  const days = d.schedule_days ?? [];
  if (days.length === 0 || !d.schedule_start_time) return;

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

  const dates: string[] = [];
  const now = toZonedTime(new Date(), tz);
  // Sertakan hari ini hanya jika termasuk hari terpilih dan jam mulai belum lewat.
  const todayIncluded =
    days.includes(getISODay(now)) && format(now, "HH:mm") < d.schedule_start_time;
  let cursor = todayIncluded ? now : addDays(now, 1);

  if (d.billing_type === "package") {
    const total = Number(d.package_sessions);
    while (dates.length < total) {
      if (days.includes(getISODay(cursor))) {
        dates.push(format(cursor, "yyyy-MM-dd"));
      }
      cursor = addDays(cursor, 1);
    }
  } else if (d.billing_type === "monthly") {
    const due = toZonedTime(nextMonthlyDueDate(Number(d.monthly_due_day), tz), tz);
    const dueKey = format(due, "yyyy-MM-dd");
    // Maksimal 2 bulan iterasi sebagai pengaman
    let guard = 0;
    while (format(cursor, "yyyy-MM-dd") <= dueKey && guard < 90) {
      if (days.includes(getISODay(cursor))) {
        dates.push(format(cursor, "yyyy-MM-dd"));
      }
      cursor = addDays(cursor, 1);
      guard += 1;
    }
  } else {
    return;
  }

  const rows = dates.map((date) => {
    const startLocal = parse(`${date} ${d.schedule_start_time}`, "yyyy-MM-dd HH:mm", new Date());
    const endLocal = addMinutes(startLocal, durationMinutes);
    return {
      user_id: userId,
      student_id: studentId,
      subject_id: d.subject_ids[0]!,
      start_at: fromZonedTime(startLocal, tz).toISOString(),
      end_at: fromZonedTime(endLocal, tz).toISOString(),
      learning_mode: d.learning_mode,
      location: clean(d.schedule_location),
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

    // Tagihan otomatis sesuai sistem pembayaran
    await createBillingInvoice(supabase, d, student.id);

    // Jadwal (opsional) — banyaknya mengikuti sistem pembayaran
    await createInitialSchedule(supabase, user.id, student.id, d);

    revalidatePath("/", "layout");
    return ok({ id: student.id });
  } catch (e) {
    return fail(actionError(e));
  }
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

    revalidatePath("/", "layout");
    return ok();
  } catch (e) {
    return fail(actionError(e));
  }
}

export async function deleteStudentAction(studentId: string): Promise<ActionResult> {
  const supabase = await createClient();

  // Siswa dengan riwayat pembayaran tidak bisa dihapus — hanya dinonaktifkan.
  const { count: paymentCount } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId);
  if ((paymentCount ?? 0) > 0) {
    return fail(
      "Siswa memiliki riwayat pembayaran sehingga tidak bisa dihapus. Silakan nonaktifkan saja."
    );
  }

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

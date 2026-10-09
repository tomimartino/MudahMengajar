"use server";

import { addMinutes, format, parse } from "date-fns";
import { id } from "date-fns/locale";
import { fromZonedTime } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { actionError, fail, ok } from "@/lib/actions/helpers";
import { studentSchema, studentIdentitySchema } from "@/lib/validations/student";
import { parseAmount } from "@/lib/utils/currency";
import { DELETE_STUDENT_CONFIRMATION } from "@/lib/constants";
import type { ActionResult } from "@/lib/actions/helpers";
import { DUPLICATE_STUDENT_MESSAGE, isDuplicateStudentError } from "@/lib/utils/student-name";
import { buildBillingSchedule } from "@/lib/utils/billing-schedule";

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
  dueDate: string;
  tz: string;
  durationMinutes: number;
}> {
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

  return { ...buildBillingSchedule(d, tz), tz, durationMinutes };
}

/** A single database transaction commits the entire student/package form. */
async function saveStudentBundle(
  supabase: Awaited<ReturnType<typeof createClient>>, userId: string,
  d: ReturnType<typeof studentSchema.parse>, studentId: string | null = null,
) {
  const schedule = await computeScheduleDates(supabase, userId, d);
  const rows = schedule.dates.map(({ date, time }) => {
    const start = parse(`${date} ${time}`, "yyyy-MM-dd HH:mm", new Date());
    return {
      start_at: fromZonedTime(start, schedule.tz).toISOString(),
      end_at: fromZonedTime(addMinutes(start, schedule.durationMinutes), schedule.tz).toISOString(),
    };
  });
  const { data, error } = await supabase.rpc("save_student_bundle", {
    p_student_id: studentId,
    p_data: {
      ...d, gender: d.gender ?? null,
      per_session_rate: d.billing_type === "per_session" ? parseAmount(d.per_session_rate) : null,
      monthly_fee: d.billing_type === "monthly" ? parseAmount(d.monthly_fee) : null,
      monthly_due_day: d.billing_type === "monthly" ? Number(d.monthly_due_day) : null,
      package_sessions: Number(d.package_sessions), package_price: parseAmount(d.package_price),
      package_per_session_rate: parseAmount(d.package_per_session_rate),
    },
    p_due_date: schedule.dueDate || null,
    p_period_label: schedule.dueDate
      ? format(parse(schedule.dueDate, "yyyy-MM-dd", new Date()), "MMMM yyyy", { locale: id }) : "",
    p_schedules: rows,
    p_package_settings: {
      learning_mode: d.learning_mode, subject_ids: d.subject_ids,
      schedule_start_date: d.schedule_start_date || schedule.dates[0]?.date || schedule.dueDate,
      schedule_times: d.schedule_times, schedule_location: d.schedule_location,
      duration_minutes: schedule.durationMinutes,
    },
  });
  if (error) throw error;
  return data;
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
    const { data: duplicate, error: duplicateError } = await supabase.rpc("student_name_conflicts", { p_name: d.full_name });
    if (duplicateError) return fail("Nama murid belum dapat diperiksa. Silakan coba lagi.");
    if (duplicate) return fail(DUPLICATE_STUDENT_MESSAGE);
    const studentId = await saveStudentBundle(supabase, user.id, d);

    revalidatePath("/", "layout");
    return ok({ id: studentId });
  } catch (e) {
    return fail(isDuplicateStudentError(e) ? DUPLICATE_STUDENT_MESSAGE : actionError(e));
  }
}

export async function updateStudentAction(
  studentId: string,
  input: unknown
): Promise<ActionResult> {
  const parsed = studentIdentitySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tidak terautentikasi.");

  try {
    const { data: student } = await supabase.from("students").select("id")
      .eq("id", studentId).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
    if (!student) return fail("Siswa tidak ditemukan.");
    const { data: duplicate, error: duplicateError } = await supabase.rpc("student_name_conflicts", {
      p_name: d.full_name, p_student_id: studentId,
    });
    if (duplicateError) return fail("Nama murid belum dapat diperiksa. Silakan coba lagi.");
    if (duplicate) return fail(DUPLICATE_STUDENT_MESSAGE);
    const { error } = await supabase.rpc("update_student_identity", {
      p_student_id: studentId, p_data: { ...d, gender: d.gender ?? null },
    });
    if (error) throw error;

    revalidatePath("/", "layout");
    return ok();
  } catch (e) {
    return fail(isDuplicateStudentError(e) ? DUPLICATE_STUDENT_MESSAGE : actionError(e));
  }
}

/**
 * Tambah paket dari halaman Murid: perbarui pembelajaran/pembayaran
 * siswa, buat paket + tagihan, dan tambahkan jadwal paket tanpa menghapus jadwal lain.
 * Identitas siswa diambil dari database — form hanya berisi 3 bagian.
 */
export async function addPackageAction(
  studentId: string,
  input: unknown
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tidak terautentikasi.");

  try {
    const { data: student } = await supabase
      .from("students")
      .select(
        "full_name, gender, birth_date, school_name, school_level, grade_level, phone, address, notes, parents(name, whatsapp)"
      )
      .eq("id", studentId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();
    if (!student) return fail("Siswa tidak ditemukan.");

    const parent = student.parents as unknown as { name: string; whatsapp: string } | null;

    // Identitas dari DB, sisanya dari form — divalidasi dengan schema yang sama.
    const parsed = studentSchema.safeParse({
      ...(input as Record<string, unknown>),
      full_name: student.full_name,
      gender: student.gender ?? null,
      birth_date: student.birth_date ?? "",
      school_name: student.school_name ?? "",
      school_level: student.school_level,
      grade_level: student.grade_level,
      phone: student.phone ?? "",
      parent_name: parent?.name ?? "",
      parent_whatsapp: parent?.whatsapp ?? "",
      address: student.address ?? "",
      notes: student.notes ?? "",
    });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
    const d = parsed.data;

    await saveStudentBundle(supabase, user.id, d, studentId);

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Tidak terautentikasi.");
  const { data, error } = await supabase.from("students").update({ status })
    .eq("id", studentId).eq("user_id", user.id).is("deleted_at", null).select("id").maybeSingle();
  if (error) return fail(actionError(error));
  if (!data) return fail("Siswa tidak ditemukan.");
  // Status controls visibility; existing schedules survive reactivation.

  revalidatePath("/", "layout");
  return ok();
}

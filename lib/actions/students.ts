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
  dueDate: string
): Promise<{ invoiceId: string | null; packageId: string | null }> {
  if (d.billing_type === "package") {
    const { data, error } = await supabase.rpc("create_package", {
      p_student_id: studentId,
      p_total_sessions: Number(d.package_sessions),
      p_per_session_rate: parseAmount(d.package_per_session_rate),
      p_price: parseAmount(d.package_price),
      p_start_date: dueDate,
    });
    if (error) throw error;
    const result = data as unknown as { invoice_id: string | null; package_id: string | null };
    return { invoiceId: result.invoice_id ?? null, packageId: result.package_id ?? null };
  }

  if (d.billing_type === "monthly") {
    const { data, error } = await supabase.rpc("create_invoice", {
      p_student_id: studentId,
      p_type: "monthly",
      p_period_label: format(parse(dueDate, "yyyy-MM-dd", new Date()), "MMMM yyyy", { locale: id }),
      p_amount: parseAmount(d.monthly_fee),
      p_due_date: dueDate,
    });
    if (error) throw error;
    return { invoiceId: (data as unknown as { invoice_id: string }).invoice_id, packageId: null };
  }

  return { invoiceId: null, packageId: null };
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

/**
 * Jadwal (opsional): buat baris schedules dari pola jadwal. Tanpa recurrence_rule.
 * computed dapat dipakai ulang dari computeScheduleDates agar tidak dihitung dua kali.
 */
async function createInitialSchedule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  studentId: string,
  d: ReturnType<typeof studentSchema.parse>,
  computed?: Awaited<ReturnType<typeof computeScheduleDates>>,
  preserveExisting = false,
  packageId: string | null = null
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
      package_id: packageId,
      subject_id: d.subject_ids[0]!,
      start_at: fromZonedTime(startLocal, tz).toISOString(),
      end_at: fromZonedTime(endLocal, tz).toISOString(),
      learning_mode: d.learning_mode,
      location: clean(d.schedule_location),
      status: ended ? "completed" : "scheduled",
    };
  });

  let newRows = rows;
  if (preserveExisting) {
    // Menambah paket tidak mengganti jadwal paket lain, termasuk yang sudah selesai/dibatalkan.
    const existingStarts = new Set<string>();
    const batchSize = 500;
    for (let offset = 0; ; offset += batchSize) {
      const { data, error } = await supabase.from("schedules")
        .select("start_at")
        .eq("user_id", userId).eq("student_id", studentId)
        .gte("start_at", rows[0].start_at).lte("start_at", rows.at(-1)!.start_at)
        .order("start_at").order("id").range(offset, offset + batchSize - 1);
      if (error) throw new Error("Gagal memeriksa jadwal yang sudah ada: " + error.message);
      for (const row of data ?? []) existingStarts.add(new Date(row.start_at).toISOString());
      if (!data || data.length < batchSize) break;
    }
    newRows = rows.filter((row) => !existingStarts.has(row.start_at));
    if (newRows.length === 0) return;
  }
  const { error } = await supabase.from("schedules").insert(newRows);
  if (error) throw new Error("Gagal membuat jadwal: " + error.message);
}

async function savePackageSettings(
  supabase: Awaited<ReturnType<typeof createClient>>, userId: string, packageId: string | null,
  d: ReturnType<typeof studentSchema.parse>, schedule: Awaited<ReturnType<typeof computeScheduleDates>>,
) {
  if (!packageId) return;
  const { error } = await supabase.from("student_packages").update({ form_settings: {
    learning_mode: d.learning_mode, subject_ids: d.subject_ids,
    schedule_start_date: d.schedule_start_date || schedule.dates[0]?.date || schedule.dueDate,
    schedule_times: d.schedule_times, schedule_location: d.schedule_location,
    duration_minutes: schedule.durationMinutes,
  } }).eq("id", packageId).eq("user_id", userId);
  if (error) throw new Error("Gagal menyimpan data paket: " + error.message);
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

    // Tagihan otomatis sesuai sistem pembayaran
    const billing = await createBillingInvoice(supabase, d, student.id, schedule.dueDate);
    await savePackageSettings(supabase, user.id, billing.packageId, d, schedule);

    // Jadwal (opsional) — banyaknya mengikuti sistem pembayaran
    await createInitialSchedule(supabase, user.id, student.id, d, schedule, false, billing.packageId);

    revalidatePath("/", "layout");
    return ok({ id: student.id });
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
      })
      .eq("id", studentId).eq("user_id", user.id).is("deleted_at", null);
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

    const { error } = await supabase
      .from("students")
      .update({
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

    // Jadwal (opsional) dihitung dulu — hari terakhir jadwal menjadi tenggat bayar paket.
    const schedule = await computeScheduleDates(supabase, user.id, d);

    // Paket + tagihan otomatis sesuai sistem pembayaran.
    const billing = await createBillingInvoice(supabase, d, studentId, schedule.dueDate);
    await savePackageSettings(supabase, user.id, billing.packageId, d, schedule);

    await createInitialSchedule(supabase, user.id, studentId, d, schedule, true, billing.packageId);

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

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { actionError, fail, ok, type ActionResult } from "@/lib/actions/helpers";
import { packageEditSchema, packageSettingsSchema } from "@/lib/validations/package-edit";
import { parseAmount } from "@/lib/utils/currency";
import type { PackageFormSetup } from "@/lib/actions/package-setup";

export interface EditablePackage {
  id: string;
  total_sessions: number;
  price: string;
  start_date: string;
  status: string;
}

export async function listEditablePackagesAction(studentId: string): Promise<ActionResult<EditablePackage[]>> {
  if (!z.string().uuid().safeParse(studentId).success) return fail("Murid tidak ditemukan.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Silakan masuk kembali.");
  const { data: student } = await supabase.from("students").select("id")
    .eq("id", studentId).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
  if (!student) return fail("Murid tidak ditemukan.");
  const packages: EditablePackage[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("student_packages")
      .select("id, total_sessions, price, start_date, status")
      .eq("student_id", studentId).eq("user_id", user.id).neq("status", "cancelled")
      .order("start_date", { ascending: false }).order("id").range(offset, offset + 499);
    if (error) return fail("Daftar paket belum dapat dimuat.");
    packages.push(...(data ?? []).map((pkg) => ({ ...pkg, price: String(pkg.price) })));
    if (!data || data.length < 500) break;
  }
  return ok(packages);
}

export async function getEditPackageSetupAction(studentId: string, packageId: string): Promise<ActionResult<PackageFormSetup>> {
  if (![studentId, packageId].every((value) => z.string().uuid().safeParse(value).success)) return fail("Paket tidak ditemukan.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Silakan masuk kembali.");
  const [pkg, student, subjects, profile] = await Promise.all([
    supabase.from("student_packages").select("*").eq("id", packageId).eq("student_id", studentId)
      .eq("user_id", user.id).neq("status", "cancelled").maybeSingle(),
    supabase.from("students").select("id, full_name, status, teaching_type, group_size").eq("id", studentId)
      .eq("user_id", user.id).is("deleted_at", null).maybeSingle(),
    supabase.from("subjects").select("id, name").eq("user_id", user.id).order("name"),
    supabase.from("profiles").select("timezone").eq("id", user.id).single(),
  ]);
  if ([pkg, student, subjects, profile].some((result) => result.error)) return fail("Form paket belum dapat dimuat.");
  if (!pkg.data || !student.data) return fail("Paket tidak ditemukan.");
  const parsed = packageSettingsSchema.safeParse(pkg.data.form_settings);
  if (!parsed.success) return fail("Data jadwal paket ini belum lengkap.");
  const settings = parsed.data;
  const history: { start_at: string; status: string }[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("schedules").select("start_at, status")
      .eq("package_id", packageId).eq("student_id", studentId).eq("user_id", user.id)
      .in("status", ["completed", "cancelled"]).order("start_at").order("id").range(offset, offset + 499);
    if (error) return fail("Riwayat jadwal paket belum dapat dimuat.");
    history.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  return ok({
    initial: { ...settings, id: studentId, full_name: student.data.full_name, status: student.data.status,
      teaching_type: student.data.teaching_type, group_size: student.data.group_size,
      billing_type: "package", package_sessions: pkg.data.total_sessions,
      package_per_session_rate: String(pkg.data.per_session_rate ?? Math.round(Number(pkg.data.price) / pkg.data.total_sessions)),
      package_price: String(pkg.data.price), package_start_date: settings.schedule_start_date },
    subjects: subjects.data ?? [], defaultDurationMinutes: settings.duration_minutes,
    timezone: profile.data?.timezone ?? "Asia/Jakarta",
    packageSchedule: { total: pkg.data.total_sessions, used: pkg.data.sessions_used,
      startDate: settings.schedule_start_date, times: settings.schedule_times, dueDate: pkg.data.start_date, history },
  });
}

export async function updatePackageAction(studentId: string, packageId: string, input: unknown): Promise<ActionResult> {
  if (![studentId, packageId].every((value) => z.string().uuid().safeParse(value).success)) return fail("Paket tidak ditemukan.");
  const parsed = packageEditSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Silakan masuk kembali.");
  const values = parsed.data;
  try {
    const { error } = await supabase.rpc("update_student_package", {
      p_student_id: studentId, p_package_id: packageId,
      p_total_sessions: Number(values.package_sessions),
      p_per_session_rate: parseAmount(values.package_per_session_rate),
      p_price: parseAmount(values.package_price),
      p_settings: { learning_mode: values.learning_mode, subject_ids: values.subject_ids,
        schedule_start_date: values.schedule_start_date, schedule_times: values.schedule_times,
        schedule_location: values.schedule_location },
    });
    if (error) return fail(error.message);
    revalidatePath("/", "layout");
    return ok();
  } catch (error) { return fail(actionError(error)); }
}

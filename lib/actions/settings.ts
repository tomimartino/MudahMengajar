"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { actionError, fail, ok } from "@/lib/actions/helpers";
import {
  billingSettingsSchema,
  chatTemplatesSchema,
} from "@/lib/validations/settings";
import type { ActionResult } from "@/lib/actions/helpers";

export async function deleteSubjectAction(subjectId: string): Promise<ActionResult> {
  const supabase = await createClient();

  // Hanya hitung murid yang belum dihapus sebagai "masih memakai" mapel ini.
  const { data: links } = await supabase
    .from("student_subjects")
    .select("student_id")
    .eq("subject_id", subjectId);
  const linkStudentIds = [...new Set((links ?? []).map((l) => l.student_id))];
  let activeLinkCount = 0;
  if (linkStudentIds.length > 0) {
    const { data: activeStudents } = await supabase
      .from("students")
      .select("id")
      .in("id", linkStudentIds)
      .is("deleted_at", null);
    activeLinkCount = activeStudents?.length ?? 0;
  }

  const [{ count: activeScheduleCount }, { count: sessionCount }] = await Promise.all([
    supabase
      .from("schedules")
      .select("id", { count: "exact", head: true })
      .eq("subject_id", subjectId)
      .neq("status", "cancelled"),
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("subject_id", subjectId),
  ]);

  if (activeLinkCount > 0 || (activeScheduleCount ?? 0) > 0 || (sessionCount ?? 0) > 0) {
    return fail("Mata pelajaran masih dipakai siswa atau jadwal.");
  }

  // Bersihkan jadwal lama yang sudah dibatalkan, lalu hapus mapelnya
  // (link student_subjects ikut terhapus via FK on delete cascade).
  const { error: scheduleError } = await supabase
    .from("schedules")
    .delete()
    .eq("subject_id", subjectId);
  if (scheduleError) return fail(actionError(scheduleError));

  const { error } = await supabase.from("subjects").delete().eq("id", subjectId);
  if (error) return fail(actionError(error));

  revalidatePath("/", "layout");
  return ok();
}

export async function updateBillingSettingsAction(input: unknown): Promise<ActionResult> {
  const parsed = billingSettingsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tidak terautentikasi.");

  const { error } = await supabase
    .from("settings")
    .update({
      default_duration_minutes: d.default_duration_minutes,
      deduct_package_policy: d.deduct_package_policy,
      payment_reminder_days: d.payment_reminder_days,
      package_low_threshold: d.package_low_threshold,
      notify_schedule: d.notify_schedule,
      notify_payment: d.notify_payment,
      notify_package: d.notify_package,
    })
    .eq("user_id", user.id);
  if (error) return fail(actionError(error));

  revalidatePath("/", "layout");
  return ok();
}

export async function updateChatTemplatesAction(input: unknown): Promise<ActionResult> {
  const parsed = chatTemplatesSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tidak terautentikasi.");

  const { error } = await supabase
    .from("settings")
    .update({
      message_template_invoice: d.message_template_invoice.trim(),
      message_template_report: d.message_template_report.trim(),
    })
    .eq("user_id", user.id);
  if (error) return fail(actionError(error));

  revalidatePath("/", "layout");
  return ok();
}

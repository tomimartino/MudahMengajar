"use server";

import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { actionError, fail, ok } from "@/lib/actions/helpers";
import {
  completeSessionSchema,
  saveSessionForScheduleSchema,
  updateAttendanceSchema,
  updateSessionSchema,
} from "@/lib/validations/session";
import type { ActionResult } from "@/lib/actions/helpers";

async function refreshRemindersSilently(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<void> {
  try {
    await supabase.rpc("refresh_reminders");
  } catch {
    // Reminder gagal — jangan gagalkan mutasi utama.
  }
}

export async function completeSessionAction(
  scheduleId: string,
  input: unknown
): Promise<ActionResult<{ sessionId: string }>> {
  const parsed = completeSessionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  const d = parsed.data;

  const supabase = await createClient();
  try {
    const { data, error } = await supabase.rpc("complete_session", {
      p_schedule_id: scheduleId,
      p_attendance: d.attendance,
      p_duration_minutes: d.duration_minutes,
      p_material: d.material.trim() || null,
      p_sub_material: d.sub_material.trim() || null,
      p_learning_notes: d.learning_notes.trim() || null,
      p_homework: d.homework.trim() || null,
      p_score: d.score,
      p_progress_notes: d.progress_notes.trim() || null,
    });
    if (error) return fail(actionError(error));

    await refreshRemindersSilently(supabase);
    revalidatePath("/", "layout");
    return ok({ sessionId: data as string });
  } catch (e) {
    return fail(actionError(e));
  }
}

export async function updateSessionAction(
  sessionId: string,
  input: unknown
): Promise<ActionResult> {
  const parsed = updateSessionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("sessions")
    .update({
      duration_minutes: d.duration_minutes,
      material: d.material.trim() || null,
      sub_material: d.sub_material.trim() || null,
      learning_notes: d.learning_notes.trim() || null,
      homework: d.homework.trim() || null,
      score: d.score === null ? null : String(d.score),
      progress_notes: d.progress_notes.trim() || null,
    })
    .eq("id", sessionId);
  if (error) return fail(actionError(error));

  revalidatePath("/", "layout");
  return ok();
}

export async function updateAttendanceAction(
  attendanceId: string,
  input: unknown
): Promise<ActionResult> {
  const parsed = updateAttendanceSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance")
    .update({ status: parsed.data.status, note: parsed.data.note.trim() || null })
    .eq("id", attendanceId);
  if (error) return fail(actionError(error));

  revalidatePath("/", "layout");
  return ok();
}

/**
 * Isi/edit materi untuk jadwal yang sudah selesai (completed).
 * Upsert sesi berdasarkan schedule_id: update bila sudah ada, insert bila belum.
 */
export async function saveSessionForScheduleAction(
  scheduleId: string,
  input: unknown
): Promise<ActionResult> {
  const parsed = saveSessionForScheduleSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tidak terautentikasi.");

  const { data: schedule, error: scheduleError } = await supabase
    .from("schedules")
    .select("id, student_id, subject_id, start_at, end_at")
    .eq("id", scheduleId)
    .eq("user_id", user.id)
    .single();
  if (scheduleError || !schedule) return fail("Jadwal tidak ditemukan.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();
  const tz = profile?.timezone ?? "Asia/Jakarta";

  const payload = {
    material: d.material.trim() || null,
    sub_material: d.sub_material.trim() || null,
    homework: d.homework.trim() || null,
    progress_notes: d.progress_notes.trim() || null,
  };

  const { data: existing } = await supabase
    .from("sessions")
    .select("id")
    .eq("schedule_id", scheduleId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("sessions")
      .update(payload)
      .eq("id", existing.id);
    if (error) return fail(actionError(error));
  } else {
    const durationMinutes = Math.max(
      1,
      Math.round(
        (new Date(schedule.end_at).getTime() - new Date(schedule.start_at).getTime()) / 60000
      )
    );
    const { error } = await supabase.from("sessions").insert({
      user_id: user.id,
      student_id: schedule.student_id,
      schedule_id: scheduleId,
      subject_id: schedule.subject_id,
      session_date: format(toZonedTime(schedule.start_at, tz), "yyyy-MM-dd"),
      started_at: schedule.start_at,
      ended_at: schedule.end_at,
      duration_minutes: durationMinutes,
      ...payload,
      status: "completed",
    });
    if (error) return fail(actionError(error));
  }

  revalidatePath("/", "layout");
  return ok();
}

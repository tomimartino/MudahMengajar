"use server";

import { addMinutes, addWeeks, parse } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { actionError, fail, ok } from "@/lib/actions/helpers";
import { scheduleSchema } from "@/lib/validations/schedule";
import { buildRule, ruleToJson } from "@/lib/utils/recurrence";
import { toDateInput } from "@/lib/utils/date";
import type { ActionResult } from "@/lib/actions/helpers";

async function getUserTz(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .single();
  return data?.timezone ?? "Asia/Jakarta";
}

export async function createScheduleAction(
  input: unknown,
  confirmConflict: boolean
): Promise<ActionResult<{ id: string }>> {
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tidak terautentikasi.");

  try {
    const tz = await getUserTz(supabase, user.id);

    // Durasi pertemuan mengikuti pengaturan guru
    const { data: settings } = await supabase
      .from("settings")
      .select("default_duration_minutes")
      .eq("user_id", user.id)
      .single();
    const durationMinutes = settings?.default_duration_minutes ?? 90;

    const startLocal = parse(`${d.date} ${d.start_time}`, "yyyy-MM-dd HH:mm", new Date());
    const endLocal = addMinutes(startLocal, durationMinutes);
    const startIso = fromZonedTime(startLocal, tz).toISOString();
    const endIso = fromZonedTime(endLocal, tz).toISOString();

    // Deteksi bentrok: jadwal lain milik guru dengan rentang saling tumpang tindih.
    const { data: conflicts } = await supabase
      .from("schedules")
      .select("id, start_at, end_at, student_id, students(full_name)")
      .eq("status", "scheduled")
      .lt("start_at", endIso)
      .gt("end_at", startIso);

    const hasConflict = (conflicts?.length ?? 0) > 0;
    if (hasConflict && !confirmConflict) {
      return { ok: false, conflict: true, conflicts: conflicts ?? [] };
    }

    const until =
      d.recurrence !== "none"
        ? d.until || toDateInput(addWeeks(startLocal, 12), tz)
        : null;

    const rule =
      d.recurrence === "none"
        ? null
        : buildRule(d.recurrence, startLocal, d.custom_days ?? [], until!);

    const { data: master, error } = await supabase
      .from("schedules")
      .insert({
        user_id: user.id,
        student_id: d.student_id,
        subject_id: d.subject_id,
        start_at: startIso,
        end_at: endIso,
        learning_mode: d.learning_mode ?? null,
        location: d.location.trim() || null,
        notes: d.notes.trim() || null,
        recurrence_rule: rule ? ruleToJson(rule) : null,
      })
      .select("id")
      .single();
    if (error) throw error;

    if (rule) {
      const { error: occError } = await supabase.rpc("generate_schedule_occurrences", {
        p_master_id: master.id,
        p_until: until!,
      });
      if (occError) throw occError;
    }

    revalidatePath("/", "layout");
    return ok({ id: master.id });
  } catch (e) {
    return fail(actionError(e));
  }
}

export async function cancelScheduleAction(scheduleId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("schedules")
    .update({ status: "cancelled" })
    .eq("id", scheduleId);
  if (error) return fail(actionError(error));

  revalidatePath("/", "layout");
  return ok();
}

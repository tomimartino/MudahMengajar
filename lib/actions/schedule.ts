"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { actionError, fail, ok } from "@/lib/actions/helpers";
import { switchScheduleSchema } from "@/lib/validations/session";
import type { ActionResult } from "@/lib/actions/helpers";

export async function cancelScheduleAction(
  scheduleId: string,
  note?: string
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(scheduleId).success) return fail("Jadwal tidak valid.");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tidak terautentikasi.");

  const { error } = await supabase.rpc("cancel_learning_schedule", {
    p_schedule_id: scheduleId, p_note: note?.trim() || null,
  });
  if (error) return fail(actionError(new Error(error.message)));

  revalidatePath("/", "layout");
  return ok();
}

export async function switchScheduleAction(
  scheduleId: string,
  input: unknown
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(scheduleId).success) return fail("Jadwal tidak valid.");
  const parsed = switchScheduleSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail("Tidak terautentikasi.");

  try {
    const { error } = await supabase.rpc("move_schedule", {
      p_schedule_id: scheduleId,
      p_date: d.date,
      p_time: d.time,
    });
    if (error) return fail(actionError(new Error(error.message)));

    try {
      await supabase.rpc("refresh_reminders");
    } catch {
      // Kegagalan reminder tidak membatalkan perpindahan yang sudah tersimpan.
    }
  } catch (error) {
    return fail(actionError(error));
  }

  revalidatePath("/", "layout");
  return ok();
}

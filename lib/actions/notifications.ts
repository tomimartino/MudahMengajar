"use server";

import { createClient } from "@/lib/supabase/server";
import { actionError, fail, ok } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/helpers";
import { z } from "zod";
import type { PreviousSession } from "@/types/database.types";

export async function getPreviousSessionAction(scheduleId: string): Promise<ActionResult<PreviousSession | null>> {
  if (!z.string().uuid().safeParse(scheduleId).success) return fail("Jadwal tidak valid.");
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return fail("Sesi berakhir. Silakan masuk kembali.");
    const { data, error } = await supabase.rpc("get_previous_session", { p_schedule_id: scheduleId });
    if (error) return fail(actionError(error));
    return ok(data as unknown as PreviousSession | null);
  } catch (error) {
    return fail(actionError(error));
  }
}

export async function refreshRemindersAction(): Promise<ActionResult<number>> {
  const supabase = await createClient();
  try {
    const { error } = await supabase.rpc("refresh_reminders");
    if (error) return fail(actionError(error));
  } catch (e) {
    return fail(actionError(e));
  }
  const { count, error } = await supabase.from("notifications")
    .select("id", { count: "exact", head: true }).is("read_at", null);
  if (error) return fail(actionError(error));
  return ok(count ?? 0);
}

export async function markNotificationReadAction(
  notificationId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
  if (error) return fail(actionError(error));

  return ok();
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tidak terautentikasi.");

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return fail(actionError(error));

  return ok();
}

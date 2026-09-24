"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { actionError, fail, ok } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/helpers";

export async function refreshRemindersAction(): Promise<ActionResult> {
  const supabase = await createClient();
  try {
    await supabase.rpc("refresh_reminders");
  } catch (e) {
    return fail(actionError(e));
  }
  revalidatePath("/", "layout");
  return ok();
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

  revalidatePath("/", "layout");
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

  revalidatePath("/", "layout");
  return ok();
}

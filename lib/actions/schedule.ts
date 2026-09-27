"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { actionError, fail, ok } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/helpers";

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

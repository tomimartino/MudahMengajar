"use server";

import { addMinutes, parse } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { actionError, fail, ok } from "@/lib/actions/helpers";
import { switchScheduleSchema } from "@/lib/validations/session";
import type { ActionResult } from "@/lib/actions/helpers";

export async function cancelScheduleAction(
  scheduleId: string,
  reducePackagePrice = false
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_schedule", {
    p_schedule_id: scheduleId,
    p_reduce_price: reducePackagePrice,
  });
  if (error) return fail(actionError(error));

  revalidatePath("/", "layout");
  return ok();
}

export async function switchScheduleAction(
  scheduleId: string,
  input: unknown
): Promise<ActionResult> {
  const parsed = switchScheduleSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: sched } = await supabase
    .from("schedules")
    .select("start_at, end_at")
    .eq("id", scheduleId)
    .eq("user_id", user!.id)
    .eq("status", "scheduled")
    .single();
  if (!sched) return fail("Jadwal tidak ditemukan atau sudah selesai.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user!.id)
    .single();
  const tz = profile?.timezone ?? "Asia/Jakarta";

  const startLocal = parse(`${d.date} ${d.time}`, "yyyy-MM-dd HH:mm", new Date());
  const durationMinutes =
    (new Date(sched.end_at).getTime() - new Date(sched.start_at).getTime()) / 60000;
  const endLocal = addMinutes(startLocal, durationMinutes);

  const { error } = await supabase
    .from("schedules")
    .update({
      start_at: fromZonedTime(startLocal, tz).toISOString(),
      end_at: fromZonedTime(endLocal, tz).toISOString(),
    })
    .eq("id", scheduleId)
    .eq("status", "scheduled");
  if (error) return fail(actionError(error));

  revalidatePath("/", "layout");
  return ok();
}

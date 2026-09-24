"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { actionError, fail, ok } from "@/lib/actions/helpers";
import { packageSchema } from "@/lib/validations/package";
import { parseAmount } from "@/lib/utils/currency";
import type { ActionResult } from "@/lib/actions/helpers";

export async function createPackageAction(input: unknown): Promise<ActionResult> {
  const parsed = packageSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  const d = parsed.data;

  const supabase = await createClient();
  try {
    const { error } = await supabase.rpc("create_package", {
      p_student_id: d.student_id,
      p_total_sessions: d.total_sessions,
      p_price: parseAmount(d.price),
      p_start_date: d.start_date,
    });
    if (error) return fail(actionError(error));

    revalidatePath("/", "layout");
    return ok();
  } catch (e) {
    return fail(actionError(e));
  }
}

/** Koreksi manual sisa paket (tidak mengubah sesi/kehadiran). */
export async function adjustPackageAction(
  packageId: string,
  sessionsUsed: number
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: pkg } = await supabase
    .from("student_packages")
    .select("total_sessions")
    .eq("id", packageId)
    .single();
  if (!pkg) return fail("Paket tidak ditemukan.");

  const clamped = Math.min(Math.max(0, Math.round(sessionsUsed)), pkg.total_sessions);
  const { error } = await supabase
    .from("student_packages")
    .update({ sessions_used: clamped })
    .eq("id", packageId);
  if (error) return fail(actionError(error));

  revalidatePath("/", "layout");
  return ok();
}

export async function cancelPackageAction(packageId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("student_packages")
    .update({ status: "cancelled" })
    .eq("id", packageId);
  if (error) return fail(actionError(error));

  revalidatePath("/", "layout");
  return ok();
}

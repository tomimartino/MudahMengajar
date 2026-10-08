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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tidak terautentikasi.");

  const { data: sched } = await supabase
    .from("schedules")
    .select("id, student_id")
    .eq("id", scheduleId)
    .eq("user_id", user.id)
    .eq("status", "scheduled")
    .maybeSingle();
  if (!sched) return fail("Jadwal tidak ditemukan atau sudah dibatalkan.");

  const patch: { status: string; notes?: string } = { status: "cancelled" };
  const trimmedNote = note?.trim() ?? "";
  if (trimmedNote) patch.notes = trimmedNote;

  const { error: cancelError } = await supabase
    .from("schedules")
    .update(patch)
    .eq("id", scheduleId)
    .eq("user_id", user.id);
  if (cancelError) return fail(actionError(cancelError));

  // Pembatalan mengurangi jumlah pertemuan paket dan harga paket + tagihan
  // sebesar tarif per pertemuan siswa.
  const { data: pkg } = await supabase
    .from("student_packages")
    .select("*")
    .eq("user_id", user.id)
    .eq("student_id", sched.student_id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const rate = pkg?.per_session_rate != null ? Number(pkg.per_session_rate) : 0;
  if (pkg && rate > 0) {
    const totalSessions = Number(pkg.total_sessions);
    const sessionsUsed = Number(pkg.sessions_used);
    const newTotal = totalSessions > sessionsUsed ? totalSessions - 1 : totalSessions;
    const newPrice = Math.max(Number(pkg.price) - rate, 0);

    await supabase
      .from("student_packages")
      .update({ total_sessions: newTotal, price: String(newPrice) })
      .eq("id", pkg.id);

    if (pkg.invoice_id) {
      const { data: inv } = await supabase
        .from("invoices")
        .select("id, amount")
        .eq("id", pkg.invoice_id)
        .maybeSingle();
      if (inv) {
        const newAmount = Math.max(Number(inv.amount) - rate, 0);
        await supabase
          .from("invoices")
          .update({ amount: String(newAmount) })
          .eq("id", inv.id);

        const { data: pays } = await supabase
          .from("payments")
          .select("amount")
          .eq("invoice_id", inv.id);
        const paid = (pays ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
        const status = paid >= newAmount ? "paid" : paid > 0 ? "partial" : "unpaid";
        await supabase.from("invoices").update({ status }).eq("id", inv.id);
      }
    }
  }

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

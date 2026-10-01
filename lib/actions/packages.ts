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
      p_per_session_rate: parseAmount(d.per_session_rate),
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

  const { data: pkg } = await supabase
    .from("student_packages")
    .select("id, student_id, invoice_id")
    .eq("id", packageId)
    .maybeSingle();
  if (!pkg) return fail("Paket tidak ditemukan.");

  const { error } = await supabase
    .from("student_packages")
    .update({ status: "cancelled" })
    .eq("id", packageId);
  if (error) return fail(actionError(error));

  // Tagihan paket ikut dihapus dari daftar tagihan.
  if (pkg.invoice_id) {
    const { error: invoiceError } = await supabase
      .from("invoices")
      .delete()
      .eq("id", pkg.invoice_id);
    if (invoiceError) return fail(actionError(invoiceError));
  }

  // Jadwal mendatang & status siswa hanya berubah bila tidak ada paket aktif lain.
  const { data: otherActive } = await supabase
    .from("student_packages")
    .select("id")
    .eq("student_id", pkg.student_id)
    .eq("status", "active")
    .neq("id", packageId)
    .limit(1)
    .maybeSingle();

  if (!otherActive) {
    // Jadwal mendatang siswa dihapus dari kalender; pertemuan yang sudah selesai tetap tercatat.
    const { error: deleteError } = await supabase
      .from("schedules")
      .delete()
      .eq("student_id", pkg.student_id)
      .eq("status", "scheduled");
    if (deleteError) return fail(actionError(deleteError));

    // Siswa dinonaktifkan saat paket terakhir yang aktif dibatalkan.
    const { error: statusError } = await supabase
      .from("students")
      .update({ status: "inactive" })
      .eq("id", pkg.student_id);
    if (statusError) return fail(actionError(statusError));
  }

  revalidatePath("/", "layout");
  return ok();
}

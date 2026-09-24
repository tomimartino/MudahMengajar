"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { actionError, fail, ok } from "@/lib/actions/helpers";
import { invoiceSchema, paymentSchema } from "@/lib/validations/payment";
import { parseAmount } from "@/lib/utils/currency";
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

export async function recordPaymentAction(input: unknown): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  const d = parsed.data;

  const supabase = await createClient();
  try {
    const { error } = await supabase.rpc("record_payment", {
      p_student_id: d.student_id,
      p_invoice_id: d.invoice_id ?? null,
      p_type: d.type,
      p_amount: parseAmount(d.amount),
      p_payment_date: d.payment_date,
      p_method: d.method,
      p_notes: d.notes.trim() || null,
    });
    if (error) return fail(actionError(error));

    await refreshRemindersSilently(supabase);
    revalidatePath("/", "layout");
    return ok();
  } catch (e) {
    return fail(actionError(e));
  }
}

export async function createInvoiceAction(input: unknown): Promise<ActionResult> {
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  const d = parsed.data;

  const supabase = await createClient();
  try {
    const { error } = await supabase.rpc("create_invoice", {
      p_student_id: d.student_id,
      p_type: d.type,
      p_period_label: d.period_label.trim() || null,
      p_amount: parseAmount(d.amount),
      p_due_date: d.due_date || null,
    });
    if (error) return fail(actionError(error));

    revalidatePath("/", "layout");
    return ok();
  } catch (e) {
    return fail(actionError(e));
  }
}

export async function deleteInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", invoiceId);
  if ((count ?? 0) > 0) {
    return fail("Tagihan dengan pembayaran tidak dapat dihapus.");
  }

  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
  if (error) return fail(actionError(error));

  revalidatePath("/", "layout");
  return ok();
}

export async function generateMonthlyInvoicesAction(
  year: number,
  month: number,
  periodLabel: string
): Promise<ActionResult<{ count: number }>> {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase.rpc("generate_monthly_invoices", {
      p_year: year,
      p_month: month,
      p_period_label: periodLabel,
    });
    if (error) return fail(actionError(error));

    await refreshRemindersSilently(supabase);
    revalidatePath("/", "layout");
    return ok({ count: (data as number) ?? 0 });
  } catch (e) {
    return fail(actionError(e));
  }
}

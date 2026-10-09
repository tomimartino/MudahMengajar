import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type StudentName = { students: { full_name: string } | null };
export type BillingInvoice = Pick<Database["public"]["Tables"]["invoices"]["Row"],
  "id" | "student_id" | "invoice_number" | "type" | "period_label" | "amount" | "due_date" | "status" | "created_at"
> & StudentName;
export type BillingPayment = Pick<Database["public"]["Tables"]["payments"]["Row"],
  "id" | "student_id" | "invoice_id" | "type" | "amount" | "payment_date" | "method" | "notes"
> & StudentName;

/** Both screens use the same ledger, keeping invoice due dates and payment dates separate.
 * Read every page so totals and invoice balances cannot be truncated by the API row limit.
 */
export async function loadBillingLedger(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  studentId?: string,
): Promise<{ invoices: BillingInvoice[]; payments: BillingPayment[] }> {
  const batchSize = 500;
  async function loadInvoices(): Promise<BillingInvoice[]> {
    const invoices: BillingInvoice[] = [];
    for (let offset = 0; ; offset += batchSize) {
      const query = supabase.from("invoices")
        .select("id, student_id, invoice_number, type, period_label, amount, due_date, status, created_at, students(full_name)")
        .eq("user_id", userId).order("id").range(offset, offset + batchSize - 1);
      if (studentId) query.eq("student_id", studentId);
      const { data, error } = await query;
      if (error) throw new Error("Tagihan belum dapat dimuat. Silakan coba lagi.");
      invoices.push(...((data ?? []) as unknown as BillingInvoice[]));
      if (!data || data.length < batchSize) return invoices;
    }
  }
  async function loadPayments(): Promise<BillingPayment[]> {
    const payments: BillingPayment[] = [];
    for (let offset = 0; ; offset += batchSize) {
      const query = supabase.from("payments")
        .select("id, student_id, invoice_id, type, amount, payment_date, method, notes, students(full_name)")
        .eq("user_id", userId).order("id").range(offset, offset + batchSize - 1);
      if (studentId) query.eq("student_id", studentId);
      const { data, error } = await query;
      if (error) throw new Error("Pembayaran belum dapat dimuat. Silakan coba lagi.");
      payments.push(...((data ?? []) as unknown as BillingPayment[]));
      if (!data || data.length < batchSize) return payments;
    }
  }
  const [invoices, payments] = await Promise.all([loadInvoices(), loadPayments()]);
  return { invoices, payments };
}

/** Include payments from every date: the balance is what remains due today. */
export function invoiceBalances(
  invoices: Pick<BillingInvoice, "id" | "amount">[],
  payments: Pick<BillingPayment, "invoice_id" | "amount">[],
): Map<string, number> {
  const paid = new Map<string, number>();
  for (const payment of payments) {
    if (payment.invoice_id) paid.set(payment.invoice_id, (paid.get(payment.invoice_id) ?? 0) + Number(payment.amount));
  }
  return new Map(invoices.map((invoice) => [invoice.id, Math.max(0, Number(invoice.amount) - (paid.get(invoice.id) ?? 0))]));
}

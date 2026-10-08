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
  userId: string
): Promise<{ invoices: BillingInvoice[]; payments: BillingPayment[] }> {
  const batchSize = 500;
  async function loadInvoices(): Promise<BillingInvoice[]> {
    const invoices: BillingInvoice[] = [];
    for (let offset = 0; ; offset += batchSize) {
      const { data, error } = await supabase.from("invoices")
        .select("id, student_id, invoice_number, type, period_label, amount, due_date, status, created_at, students(full_name)")
        .eq("user_id", userId).order("id").range(offset, offset + batchSize - 1);
      if (error) throw new Error("Tagihan belum dapat dimuat. Silakan coba lagi.");
      invoices.push(...((data ?? []) as unknown as BillingInvoice[]));
      if (!data || data.length < batchSize) return invoices;
    }
  }
  async function loadPayments(): Promise<BillingPayment[]> {
    const payments: BillingPayment[] = [];
    for (let offset = 0; ; offset += batchSize) {
      const { data, error } = await supabase.from("payments")
        .select("id, student_id, invoice_id, type, amount, payment_date, method, notes, students(full_name)")
        .eq("user_id", userId).order("id").range(offset, offset + batchSize - 1);
      if (error) throw new Error("Pembayaran belum dapat dimuat. Silakan coba lagi.");
      payments.push(...((data ?? []) as unknown as BillingPayment[]));
      if (!data || data.length < batchSize) return payments;
    }
  }
  const [invoices, payments] = await Promise.all([loadInvoices(), loadPayments()]);
  return { invoices, payments };
}

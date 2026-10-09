import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { BillingInvoice, BillingPayment } from "@/lib/finance/data";
import { monthDateRange } from "@/lib/finance/queries";

type Supabase = SupabaseClient<Database>;
export const PAYMENT_PAGE_SIZE = 50;
export type MonthInvoice = BillingInvoice & { paid_amount: number };

export function billingPage(value: unknown): number {
  const page = typeof value === "string" || typeof value === "number" ? Number(value) : 1;
  return Number.isFinite(page) ? Math.max(1, Math.min(1_000_000, Math.floor(page))) : 1;
}

export async function loadBillingSummary(supabase: Supabase) {
  const { data, error } = await supabase.rpc("get_billing_summary");
  if (error) throw new Error("Ringkasan keuangan belum dapat dimuat. Silakan coba lagi.");
  return data ?? [];
}

export async function loadMonthInvoices(supabase: Supabase, month: string): Promise<MonthInvoice[]> {
  const { data, error } = await supabase.rpc("get_month_invoices", { p_month: month });
  if (error || !Array.isArray(data)) throw new Error("Tagihan belum dapat dimuat. Silakan coba lagi.");
  return data as unknown as MonthInvoice[];
}

export async function loadMonthPayments(supabase: Supabase, userId: string, month: string, requestedPage = 1, ascending = false) {
  const range = monthDateRange(month);
  async function read(page: number) {
    return supabase.from("payments")
      .select("id, student_id, invoice_id, type, amount, payment_date, method, notes, students(full_name)", { count: "exact" })
      .eq("user_id", userId).gte("payment_date", range.start).lte("payment_date", range.end)
      .order("payment_date", { ascending }).order("id", { ascending })
      .range((page - 1) * PAYMENT_PAGE_SIZE, page * PAYMENT_PAGE_SIZE - 1);
  }
  const requested = billingPage(requestedPage);
  let result = await read(requested);
  let count = result.count ?? 0;
  // PostgREST returns 416 for a page beyond the final row. Resolve its actual
  // size before reading the last page, including after transactions are deleted.
  if (result.error && result.status === 416) {
    const total = await supabase.from("payments").select("id", { count: "exact", head: true })
      .eq("user_id", userId).gte("payment_date", range.start).lte("payment_date", range.end);
    if (total.error) throw new Error("Pembayaran belum dapat dimuat. Silakan coba lagi.");
    count = total.count ?? 0;
  } else if (result.error) throw new Error("Pembayaran belum dapat dimuat. Silakan coba lagi.");
  const totalPages = Math.max(1, Math.ceil(count / PAYMENT_PAGE_SIZE));
  const page = Math.min(requested, totalPages);
  if (page !== requested) {
    result = await read(page);
    if (result.error) throw new Error("Pembayaran belum dapat dimuat. Silakan coba lagi.");
  }
  return { payments: (result.data ?? []) as unknown as BillingPayment[], count, page, totalPages };
}

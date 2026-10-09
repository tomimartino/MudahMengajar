// Opt-in checks against disposable users in the linked project. Customer records are untouched.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { loadBillingLedger, invoiceBalances } from "@/lib/finance/data";
import { loadBillingSummary, loadMonthInvoices, loadMonthPayments } from "@/lib/finance/overview";
import { aggregateInvoiceMonthly, aggregateMonthly } from "@/lib/finance/queries";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter((l) => /^[\w]+=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")]; }));
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options);
const teacher = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
const anonymous = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
const userIds: string[] = [];
let uid = "", studentId = "", septemberInvoice = "";
async function must<T extends { data: unknown; error: { message: string } | null }>(query: PromiseLike<T>) {
  const result = await query; if (result.error) throw new Error(result.error.message);
  if (result.data == null) throw new Error("Missing fixture result"); return result.data as NonNullable<T["data"]>;
}
async function account(client: SupabaseClient<Database>) {
  const credentials = { email: `qa-loading-${randomUUID()}@example.invalid`, password: randomBytes(28).toString("base64url") };
  const result = await must(service.auth.admin.createUser({ ...credentials, email_confirm: true, user_metadata: { full_name: "QA Loading" } }));
  userIds.push(result.user!.id);
  await must(client.auth.signInWithPassword(credentials));
  await must(service.from("profiles").update({ timezone: "Asia/Jakarta", onboarding_completed: true }).eq("id", result.user!.id).select("id"));
  return result.user!.id;
}
beforeAll(async () => {
  uid = await account(teacher);
  studentId = (await must(teacher.from("students").insert({ user_id: uid, full_name: "QA Loading", school_level: "SD", grade_level: "4", billing_type: "package" }).select("id").single())).id;
  const invoices = await must(service.from("invoices").insert([
    { user_id: uid, student_id: studentId, invoice_number: "QA-SEP", type: "package", amount: "600", due_date: "2026-09-30", status: "partial", created_at: "2026-10-09T08:00:00Z" },
    { user_id: uid, student_id: studentId, invoice_number: "QA-OCT", type: "package", amount: "400", due_date: "2026-10-30", status: "unpaid", created_at: "2026-10-09T08:00:00Z" },
    { user_id: uid, student_id: studentId, invoice_number: "QA-NODUE", type: "other", amount: "300", due_date: null, status: "unpaid", created_at: "2026-09-30T18:00:00Z" },
  ]).select("id,invoice_number"));
  septemberInvoice = invoices.find((i) => i.invoice_number === "QA-SEP")!.id;
  const historical = Array.from({ length: 1005 }, () => ({ user_id: uid, student_id: studentId, type: "other", amount: "1", payment_date: "2025-01-15", method: "cash" }));
  await must(service.from("payments").insert([...historical,
    { user_id: uid, student_id: studentId, invoice_id: septemberInvoice, type: "package", amount: "100", payment_date: "2026-09-15", method: "cash" },
    { user_id: uid, student_id: studentId, invoice_id: septemberInvoice, type: "package", amount: "50", payment_date: "2026-10-15", method: "cash" },
    { user_id: uid, student_id: studentId, invoice_id: septemberInvoice, type: "package", amount: "200", payment_date: "2026-11-15", method: "cash" },
  ]).select("id"));
});
afterAll(async () => {
  await teacher.auth.signOut({ scope: "local" });
  for (const id of userIds) { const result = await service.auth.admin.deleteUser(id); if (result.error) throw new Error("Fixture cleanup failed"); }
});

describe("optimized teacher loading", () => {
  it("matches the complete ledger beyond 1000 payments, including cross-month receipts", async () => {
    const start = performance.now();
    const ledger = await loadBillingLedger(teacher, uid);
    const legacyMs = performance.now() - start;
    const optimizedStart = performance.now();
    const summary = await loadBillingSummary(teacher);
    const optimizedMs = performance.now() - optimizedStart;
    const estimates = aggregateInvoiceMonthly(ledger.invoices, "Asia/Jakarta");
    const received = aggregateMonthly(ledger.payments);
    expect(ledger.payments).toHaveLength(1008);
    for (const row of summary) {
      expect(Number(row.estimated_income)).toBe(estimates.get(row.month_key) ?? 0);
      expect(Number(row.income)).toBe(received.get(row.month_key)?.total ?? 0);
      expect(Number(row.payment_count)).toBe(received.get(row.month_key)?.count ?? 0);
    }
    expect(summary.find((r) => r.month_key === "2026-09")?.estimated_income).toBe(600);
    expect(summary.find((r) => r.month_key === "2026-10")?.estimated_income).toBe(700);
    const comparison = { comparison: "ledger_vs_summary", ledgerRows: ledger.invoices.length + ledger.payments.length,
      summaryRows: summary.length, ledgerBytes: JSON.stringify(ledger).length, summaryBytes: JSON.stringify(summary).length,
      legacyMs: Math.round(legacyMs), optimizedMs: Math.round(optimizedMs) };
    if (process.env.QA_EVIDENCE) writeFileSync(process.env.QA_EVIDENCE, JSON.stringify(comparison, null, 2));
  });
  it("keeps invoice balances correct when payments occur outside the selected month", async () => {
    const [invoices, ledger, report] = await Promise.all([
      loadMonthInvoices(teacher, "2026-09"), loadBillingLedger(teacher, uid),
      teacher.rpc("get_report_invoice_balances", { p_from: "2026-09-01", p_to: "2026-09-30", p_student: studentId }),
    ]);
    expect(invoices).toHaveLength(1);
    expect(Number(invoices[0].paid_amount)).toBe(350);
    expect(invoiceBalances(ledger.invoices, ledger.payments).get(invoices[0].id)).toBe(250);
    expect(report.error).toBeNull();
    expect(report.data).toEqual([{ student_id: studentId, balance: 250 }]);
  });
  it("paginates all transactions without truncating totals, losing rows, or duplicating rows", async () => {
    const first = await loadMonthPayments(teacher, uid, "2025-01", 1);
    const last = await loadMonthPayments(teacher, uid, "2025-01", 21);
    expect(first.count).toBe(1005); expect(first.payments).toHaveLength(50);
    expect(first.totalPages).toBe(21); expect(last.payments).toHaveLength(5);
    expect(first.payments.some((p) => last.payments.some((q) => q.id === p.id))).toBe(false);
    const clamped = await loadMonthPayments(teacher, uid, "2025-01", 999);
    expect(clamped.page).toBe(21); expect(clamped.payments.map((p) => p.id)).toEqual(last.payments.map((p) => p.id));
    expect((await loadMonthPayments(teacher, uid, "2026-10")).payments.map((p) => Number(p.amount))).toEqual([50]);
  });
  it("uses the teacher timezone for invoices without a due date and reflects profile updates", async () => {
    await must(service.from("profiles").update({ timezone: "America/Los_Angeles" }).eq("id", uid).select("id"));
    try {
      const summary = await loadBillingSummary(teacher);
      expect(summary.find((r) => r.month_key === "2026-09")?.estimated_income).toBe(900);
      expect((await loadMonthInvoices(teacher, "2026-09")).map((i) => i.invoice_number)).toContain("QA-NODUE");
    } finally { await must(service.from("profiles").update({ timezone: "Asia/Jakarta" }).eq("id", uid).select("id")); }
  });
  it("does not expose another teacher's ledger and denies anonymous RPC execution", async () => {
    const other = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
    await account(other);
    try {
      expect(await loadBillingSummary(other)).toEqual([]);
      expect(await loadMonthInvoices(other, "2026-09")).toEqual([]);
      expect((await loadMonthPayments(other, uid, "2025-01")).count).toBe(0);
    } finally { await other.auth.signOut({ scope: "local" }); }
    expect((await anonymous.rpc("get_billing_summary")).error).not.toBeNull();
    expect((await anonymous.rpc("get_month_invoices", { p_month: "2026-09" })).error).not.toBeNull();
    expect((await teacher.rpc("get_month_invoices", { p_month: "2026-13" })).error).not.toBeNull();
  });
});

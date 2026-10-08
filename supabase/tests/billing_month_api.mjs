// Verify authenticated rendering against real, disposable billing records.
// Run with QA_LOCAL_URL pointing to the local app. No customer records are modified.
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter((line) => /^[\w]+=/.test(line)).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")];
  }));
const appUrl = process.env.QA_LOCAL_URL;
assert(appUrl, "Set QA_LOCAL_URL to the local application.");
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, options);
const teacher = createClient(url, anon, options);
let userId;

async function must(request) {
  const result = await request;
  if (result.error) throw new Error(`Billing API check failed (${result.error.code ?? result.error.status ?? "unknown"})`);
  return result.data;
}

const visibleText = (html) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")
  .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
function financeCard(html, month) {
  const [year] = month.split("-");
  const match = html.match(new RegExp(`<a\\b[^>]*href="/finance\\?year=${year}&amp;month=${month}"[^>]*>([\\s\\S]*?)</a>`));
  assert(match, `Monthly card missing: ${month}`);
  return visibleText(match[1]);
}
function assertCard(html, month, income, estimate) {
  const card = financeCard(html, month);
  assert(card.includes(`Pendapatan Rp${income}`), `Wrong income in ${month}: ${card}`);
  assert(card.includes(`Estimasi: Rp${estimate}`), `Wrong estimate in ${month}: ${card}`);
}

try {
  const credentials = { email: `qa-billing-${randomUUID()}@example.invalid`, password: randomBytes(28).toString("base64url") };
  const created = await must(service.auth.admin.createUser({ ...credentials, email_confirm: true,
    user_metadata: { full_name: "Pengujian Bulan Tagihan" } }));
  userId = created.user.id;
  await must(teacher.auth.signInWithPassword(credentials));
  await must(service.from("profiles").update({ onboarding_completed: true, timezone: "Asia/Jakarta" }).eq("id", userId));
  const student = await must(teacher.from("students").insert({ user_id: userId,
    full_name: "Murid Uji Tagihan", school_level: "SD", grade_level: "4", billing_type: "package" }).select("id").single());

  async function packageInvoice(dueDate, amount) {
    return must(teacher.rpc("create_package", { p_student_id: student.id, p_total_sessions: 6,
      p_per_session_rate: amount / 6, p_price: amount, p_start_date: dueDate }));
  }
  async function pay(invoice, amount, paymentDate, notes) {
    await must(teacher.rpc("record_payment", { p_student_id: student.id, p_invoice_id: invoice?.invoice_id ?? null,
      p_type: invoice ? "package" : "other", p_amount: amount, p_payment_date: paymentDate, p_method: "cash", p_notes: notes }));
  }
  const september = await packageInvoice("2026-09-21", 300000);
  const septemberUnpaid = await packageInvoice("2026-09-23", 200000);
  const septemberPartial = await packageInvoice("2026-09-30", 400000);
  const october = await packageInvoice("2026-10-21", 600000);
  const lastYear = await packageInvoice("2025-12-31", 125000);
  const nextYear = await packageInvoice("2027-01-04", 80000);
  // Ensure the regression is exercised independently of when this check is run.
  await must(service.from("invoices").update({ created_at: "2026-10-09T08:00:00Z" }).eq("user_id", userId));
  await pay(september, 100000, "2026-09-10", "Cicilan September A");
  await pay(september, 75000, "2026-10-09", "Cicilan September B");
  await pay(september, 125000, "2026-11-01", "Pelunasan September");
  await pay(septemberPartial, 50000, "2026-10-09", "Cicilan Tagihan September Lain");
  await pay(october, 200000, "2026-09-29", "Pembayaran Awal Oktober");
  await pay(october, 100000, "2026-11-01", "Cicilan Oktober");
  await pay(lastYear, 125000, "2026-01-05", "Pelunasan Tahun Sebelumnya");
  await pay(nextYear, 80000, "2026-12-31", "Pembayaran Tahun Berikutnya");
  await pay(null, 25000, "2026-10-09", "Transaksi Tanpa Tagihan");

  // A date-less legacy invoice uses its creation month in the teacher's timezone.
  const legacy = await must(teacher.rpc("create_invoice", { p_student_id: student.id, p_type: "other",
    p_period_label: "Tagihan Tanpa Tenggat", p_amount: 90000, p_due_date: null }));
  await must(service.from("invoices").update({ created_at: "2025-09-30T18:00:00Z" }).eq("id", legacy.invoice_id).eq("user_id", userId));
  await pay(legacy, 90000, "2026-10-09", "Pelunasan Tanpa Tenggat");
  const states = await must(teacher.from("invoices").select("id, status").eq("user_id", userId));
  assert.equal(states.find((invoice) => invoice.id === september.invoice_id)?.status, "paid");
  assert.equal(states.find((invoice) => invoice.id === septemberPartial.invoice_id)?.status, "partial");
  assert.equal(states.find((invoice) => invoice.id === septemberUnpaid.invoice_id)?.status, "unpaid");

  const cookies = new Map();
  const ssr = createServerClient(url, anon, { cookies: {
    getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
    setAll: (values) => { for (const value of values) cookies.set(value.name, value.value); },
  } });
  const { session } = await must(teacher.auth.getSession());
  await must(ssr.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token }));
  const cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  async function page(route) {
    const response = await fetch(`${appUrl}${route}`, { headers: { Cookie: cookie }, redirect: "manual" });
    assert.equal(response.status, 200, `Route failed: ${route}`);
    const html = await response.text();
    assert(!html.includes('id="__next_error__"'), `Route rendering failed: ${route}`);
    return html;
  }
  const septemberHtml = await page("/payments?month=2026-09");
  const septemberPage = visibleText(septemberHtml);
  for (const invoice of [september, septemberPartial, septemberUnpaid]) assert(septemberPage.includes(invoice.invoice_number));
  assert(!septemberPage.includes(october.invoice_number), "October invoice leaked into September");
  assert(septemberPage.includes("Cicilan September A"));
  assert(septemberPage.includes("Pembayaran Awal Oktober"));
  assert(!septemberPage.includes("Cicilan September B") && !septemberPage.includes("Pelunasan September"));
  const unpaidRow = [...septemberHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)]
    .find((row) => row[1].includes(septemberUnpaid.invoice_number));
  assert(unpaidRow && visibleText(unpaidRow[1]).includes("Belum Bayar"), "Unpaid invoice status was replaced by its due date");
  assert(!visibleText(unpaidRow[1]).includes("Jatuh Tempo"), "Unpaid badge still says due");
  const octoberPage = visibleText(await page("/payments?month=2026-10"));
  assert(octoberPage.includes(october.invoice_number));
  assert(!octoberPage.includes(september.invoice_number), "Backdated invoice appeared in its creation month");
  assert(!octoberPage.includes("Pembayaran Awal Oktober") && !octoberPage.includes("Cicilan Oktober"));
  assert(octoberPage.includes("Transaksi Tanpa Tagihan"));
  assert(octoberPage.includes("Cicilan September B") && octoberPage.includes("Cicilan Tagihan September Lain"));
  assert(!octoberPage.includes("Pelunasan September") && octoberPage.includes("Pelunasan Tanpa Tenggat"));
  const finance = await page("/finance?year=2026&month=2026-09");
  assertCard(finance, "2026-09", "300.000", "900.000");
  assertCard(finance, "2026-10", "240.000", "600.000");
  assertCard(finance, "2026-11", "225.000", "0");
  assertCard(finance, "2026-01", "125.000", "0");
  assertCard(finance, "2026-12", "80.000", "0");
  assertCard(await page("/finance?year=2025&month=2025-12"), "2025-12", "0", "125.000");
  assertCard(await page("/finance?year=2025&month=2025-10"), "2025-10", "0", "90.000");
  assertCard(await page("/finance?year=2027&month=2027-01"), "2027-01", "0", "80.000");
  console.log("PASS: invoices and estimates follow due dates; transactions and income follow chosen payment dates, including installments and different years.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Billing integration check failed");
  process.exitCode = 1;
} finally {
  if (userId) {
    await teacher.auth.signOut();
    const result = await service.auth.admin.deleteUser(userId);
    if (result.error) { console.error("Disposable billing account cleanup failed"); process.exitCode = 1; }
    else console.log("Disposable billing records cleaned up.");
  }
}

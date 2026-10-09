// Opt-in QA against Supabase, using disposable accounts only.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const runtime = vi.hoisted(() => ({ client: null as SupabaseClient<Database> | null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => runtime.client! }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { createStudentAction, addPackageAction } from "@/lib/actions/students";
import { cancelScheduleAction, switchScheduleAction } from "@/lib/actions/schedule";
import { completeSessionAction, saveSessionForScheduleAction, updateSessionAction } from "@/lib/actions/sessions";
import { recordPaymentAction } from "@/lib/actions/payments";
import { getEditPackageSetupAction } from "@/lib/actions/package-edit";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter(l => /^[\w]+=/.test(l)).map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")]; }));
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options);
const teacher = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
let uid: string | undefined;
let subject: string;
async function must<T extends { data: unknown; error: { message: string } | null }>(q: PromiseLike<T>): Promise<NonNullable<T["data"]>> {
  const r = await q;
  if (r.error) throw new Error(r.error.message);
  if (r.data == null) throw new Error("QA returned no data");
  return r.data as NonNullable<T["data"]>;
}
const input = (name: string, start = "2026-11-01", count = 4) => ({ full_name: name, school_level: "SD", grade_level: "4",
  status: "active", learning_mode: "offline", billing_type: "package", package_sessions: String(count),
  package_per_session_rate: "50000", package_price: String(count * 50000), subject_ids: [subject],
  schedule_start_date: start, schedule_times: [{ day: 7, start_time: "16:00" }] });
async function fixture(name: string, start?: string, count?: number) {
  const created = await createStudentAction(input(name, start, count));
  expect(created.ok, created.error).toBe(true);
  const sid = created.data!.id;
  const pkg = await must(teacher.from("student_packages").select("*").eq("student_id", sid).single());
  const schedules = await must(teacher.from("schedules").select("*").eq("package_id", pkg.id).order("start_at"));
  return { sid, pkg, schedules };
}
async function due(id: string, invoice: string) {
  return Promise.all([
    must(teacher.from("student_packages").select("start_date,total_sessions,sessions_used,price,status").eq("id", id).single()),
    must(teacher.from("invoices").select("due_date,amount,status").eq("id", invoice).single()),
  ]);
}
beforeAll(async () => {
  const credentials = { email: `qa-schedule-${randomUUID()}@example.invalid`, password: randomBytes(28).toString("base64url") };
  const created = await must(service.auth.admin.createUser({ ...credentials, email_confirm: true, user_metadata: { full_name: "QA Mutasi Jadwal" } }));
  uid = created.user!.id;
  await must(teacher.auth.signInWithPassword(credentials));
  runtime.client = teacher;
  await must(service.from("profiles").update({ onboarding_completed: true, timezone: "Asia/Jakarta" }).eq("id", uid).select("id"));
  subject = (await must(teacher.from("subjects").insert({ user_id: uid, name: "QA Matematika" }).select("id").single())).id;
});
afterAll(async () => {
  try { await teacher.auth.signOut(); }
  finally { if (uid) await must(service.auth.admin.deleteUser(uid)); }
});

describe("schedule mutations and package deadlines", () => {
  it("reschedules November 2 to October 3, completing the past meeting with an October 26 deadline and preserving payment dates", async () => {
    const result = await createStudentAction({ ...input("QA Pola Zafran", "2026-10-01", 5),
      schedule_times: [{ day: 1, start_time: "16:30" }] });
    expect(result.ok, result.error).toBe(true);
    const sid = result.data!.id;
    const pkg = await must(teacher.from("student_packages").select("*").eq("student_id", sid).single());
    expect(pkg.start_date).toBe("2026-11-02");
    const schedules = await must(teacher.from("schedules").select("*").eq("package_id", pkg.id).order("start_at"));
    expect(schedules).toHaveLength(5);
    expect(schedules[4].start_at).toBe("2026-11-02T09:30:00+00:00");
    expect((await recordPaymentAction({ student_id: sid, invoice_id: pkg.invoice_id, type: "package", amount: "50000",
      payment_date: "2026-09-30", method: "cash" })).ok).toBe(true);
    const payments = await must(teacher.from("payments").select("*").eq("invoice_id", pkg.invoice_id!));
    const summaryBefore = await must(teacher.rpc("get_billing_summary"));
    const estimateBefore = (key: string) => Number(summaryBefore.find(row => row.month_key === key)?.estimated_income ?? 0);
    const moved = await switchScheduleAction(schedules[4].id, { date: "2026-10-03", time: "09:00" });
    expect(moved.ok, moved.error).toBe(true);
    expect(await must(teacher.from("schedules").select("start_at,end_at,status").eq("id", schedules[4].id).single()))
      .toEqual({ start_at: "2026-10-03T02:00:00+00:00", end_at: "2026-10-03T03:30:00+00:00", status: "completed" });
    expect(await due(pkg.id, pkg.invoice_id!)).toEqual([
      { start_date: "2026-10-26", total_sessions: 5, sessions_used: 0, price: 250000, status: "active" },
      { due_date: "2026-10-26", amount: 250000, status: "partial" },
    ]);
    const updated = await must(teacher.from("student_packages").select("form_settings").eq("id", pkg.id).single());
    expect(updated.form_settings).toEqual({ ...(pkg.form_settings as object), schedule_start_date: "2026-10-03" });
    const edit = await getEditPackageSetupAction(sid, pkg.id);
    expect(edit.ok, edit.error).toBe(true);
    expect(edit.data!.initial.schedule_start_date).toBe("2026-10-03");
    expect(edit.data!.packageSchedule).toMatchObject({ startDate: "2026-10-03", dueDate: "2026-10-26" });
    expect(await must(teacher.from("sessions").select("id").eq("schedule_id", schedules[4].id))).toEqual([]);
    expect(await must(teacher.from("schedules").select("*").eq("package_id", pkg.id).neq("id", schedules[4].id).order("start_at")))
      .toEqual(schedules.slice(0, 4));
    const summaryAfter = await must(teacher.rpc("get_billing_summary"));
    const estimateAfter = (key: string) => Number(summaryAfter.find(row => row.month_key === key)?.estimated_income ?? 0);
    expect(estimateAfter("2026-10") - estimateBefore("2026-10")).toBe(250000);
    expect(estimateAfter("2026-11") - estimateBefore("2026-11")).toBe(-250000);
    expect(summaryAfter.map(row => [row.month_key, row.income]).filter(([, amount]) => Number(amount) !== 0))
      .toEqual(summaryBefore.map(row => [row.month_key, row.income]).filter(([, amount]) => Number(amount) !== 0));
    expect(await must(teacher.from("payments").select("*").eq("invoice_id", pkg.invoice_id!))).toEqual(payments);
    expect((await switchScheduleAction(schedules[4].id, { date: "2026-10-03", time: "09:00" })).ok).toBe(true);
    expect((await due(pkg.id, pkg.invoice_id!))[0].sessions_used).toBe(0);
  });

  it("follows the earliest active meeting in the teacher's timezone and excludes cancelled meetings without changing another package", async () => {
    const { sid, pkg, schedules } = await fixture("QA Tanggal Mulai Paket");
    expect((await addPackageAction(sid, input("QA Tanggal Mulai Paket", "2026-12-01"))).ok).toBe(true);
    const other = await must(teacher.from("student_packages").select("*").eq("student_id", sid).neq("id", pkg.id).single());
    const otherInvoice = await must(teacher.from("invoices").select("*").eq("id", other.invoice_id!).single());
    const dates = async () => {
      const row = await must(teacher.from("student_packages").select("form_settings,start_date").eq("id", pkg.id).single());
      return { first: (row.form_settings as { schedule_start_date: string }).schedule_start_date, last: row.start_date };
    };
    // 00:30 in Jakarta is still the preceding UTC date.
    expect((await switchScheduleAction(schedules[1].id, { date: "2026-10-31", time: "00:30" })).ok).toBe(true);
    expect(await dates()).toEqual({ first: "2026-10-31", last: "2026-11-22" });
    expect((await switchScheduleAction(schedules[1].id, { date: "2026-11-15", time: "12:00" })).ok).toBe(true);
    expect(await dates()).toEqual({ first: "2026-11-01", last: "2026-11-22" });
    expect((await cancelScheduleAction(schedules[0].id)).ok).toBe(true);
    expect(await dates()).toEqual({ first: "2026-11-15", last: "2026-11-22" });
    expect((await cancelScheduleAction(schedules[1].id)).ok).toBe(true);
    expect(await dates()).toEqual({ first: "2026-11-15", last: "2026-11-22" });
    expect((await cancelScheduleAction(schedules[2].id)).ok).toBe(true);
    expect(await dates()).toEqual({ first: "2026-11-22", last: "2026-11-22" });
    expect((await cancelScheduleAction(schedules[3].id)).ok).toBe(true);
    expect(await dates()).toEqual({ first: "2026-11-22", last: "2026-11-22" });
    expect(await must(teacher.from("student_packages").select("*").eq("id", other.id).single())).toEqual(other);
    expect(await must(teacher.from("invoices").select("*").eq("id", other.invoice_id!).single())).toEqual(otherInvoice);
  });

  it("keeps estimates in the due month and income in the selected payment month after full payment", async () => {
    const baseline = await must(teacher.rpc("get_billing_summary"));
    const baselineAmount = (key: string, field: "estimated_income" | "income") => Number(baseline.find(row => row.month_key === key)?.[field] ?? 0);
    const { sid, pkg } = await fixture("QA Estimasi dan Tanggal Pembayaran", "2026-09-01");
    expect((await due(pkg.id, pkg.invoice_id!))[1].due_date).toBe("2026-09-27");
    const before = await must(teacher.rpc("get_billing_summary"));
    const beforeSeptember = before.find(row => row.month_key === "2026-09");
    expect(Number(beforeSeptember?.estimated_income)).toBe(baselineAmount("2026-09", "estimated_income") + 200000);
    expect(Number(beforeSeptember?.income)).toBe(baselineAmount("2026-09", "income"));
    const recorded = await recordPaymentAction({ student_id: sid, invoice_id: pkg.invoice_id, type: "package",
      amount: "200000", payment_date: "2026-10-05", method: "cash" });
    expect(recorded.ok, recorded.error).toBe(true);
    expect((await due(pkg.id, pkg.invoice_id!))[1]).toEqual({ due_date: "2026-09-27", amount: 200000, status: "paid" });
    const after = await must(teacher.rpc("get_billing_summary"));
    const september = after.find(row => row.month_key === "2026-09");
    const october = after.find(row => row.month_key === "2026-10");
    expect(Number(september?.estimated_income)).toBe(baselineAmount("2026-09", "estimated_income") + 200000);
    expect(Number(september?.income)).toBe(baselineAmount("2026-09", "income"));
    expect(Number(october?.estimated_income)).toBe(baselineAmount("2026-10", "estimated_income"));
    expect(Number(october?.income)).toBe(baselineAmount("2026-10", "income") + 200000);
    expect(await must(teacher.from("payments").select("payment_date,amount").eq("invoice_id", pkg.invoice_id!).single()))
      .toEqual({ payment_date: "2026-10-05", amount: 200000 });
  });

  it("moves the last September meeting into October and back; finance follows due dates, income keeps the payment date", async () => {
    const baseline = await must(teacher.rpc("get_billing_summary"));
    const septemberIncomeBefore = Number(baseline.find(row => row.month_key === "2026-09")?.income ?? 0);
    const { sid, pkg, schedules } = await fixture("QA Tenggat Lintas Bulan", "2026-09-01");
    expect((await due(pkg.id, pkg.invoice_id!))[1].due_date).toBe("2026-09-27");
    expect((await addPackageAction(sid, input("QA Tenggat Lintas Bulan", "2026-11-01"))).ok).toBe(true);
    const other = await must(teacher.from("student_packages").select("*").eq("student_id", sid).neq("id", pkg.id).single());
    const otherBefore = await due(other.id, other.invoice_id!);
    expect((await recordPaymentAction({ student_id: sid, invoice_id: pkg.invoice_id, type: "package", amount: "50000",
      payment_date: "2026-09-10", method: "cash" })).ok).toBe(true);
    const payments = await must(teacher.from("payments").select("*").eq("invoice_id", pkg.invoice_id!));
    const moved = await switchScheduleAction(schedules[3].id, { date: "2026-10-02", time: "16:00" });
    expect(moved.ok, moved.error).toBe(true);
    expect(await due(pkg.id, pkg.invoice_id!)).toEqual([
      { start_date: "2026-10-02", total_sessions: 4, sessions_used: 0, price: 200000, status: "active" },
      { due_date: "2026-10-02", amount: 200000, status: "partial" },
    ]);
    expect(await due(other.id, other.invoice_id!)).toEqual(otherBefore);
    const september = await must(teacher.rpc("get_month_invoices", { p_month: "2026-09" })) as unknown as { id: string }[];
    const october = await must(teacher.rpc("get_month_invoices", { p_month: "2026-10" })) as unknown as { id: string }[];
    expect(september.some(row => row.id === pkg.invoice_id)).toBe(false);
    expect(october.some(row => row.id === pkg.invoice_id)).toBe(true);
    expect(await must(teacher.from("payments").select("*").eq("invoice_id", pkg.invoice_id!))).toEqual(payments);
    expect((await switchScheduleAction(schedules[3].id, { date: "2026-09-19", time: "16:00" })).ok).toBe(true);
    expect((await due(pkg.id, pkg.invoice_id!))[1].due_date).toBe("2026-09-20");
    expect((await switchScheduleAction(schedules[0].id, { date: "2026-09-01", time: "23:30" })).ok).toBe(true);
    expect((await due(pkg.id, pkg.invoice_id!))[1].due_date).toBe("2026-09-20");
    const summary = await must(teacher.rpc("get_billing_summary"));
    const septemberSummary = summary.find(row => row.month_key === "2026-09");
    expect(Number(septemberSummary?.income)).toBe(septemberIncomeBefore + 50000);
  });

  it("moves a completed lesson with its material, duration and attendance without another package deduction", async () => {
    const { pkg, schedules } = await fixture("QA Pindah Selesai");
    const completed = await completeSessionAction(schedules[3].id, { attendance: "hadir", duration_minutes: 90,
      material: "Pecahan", homework: "Latihan pecahan", homework_due_date: "2026-12-03", score: 85 });
    expect(completed.ok, completed.error).toBe(true);
    const sessionId = completed.data!.sessionId;
    const attendance = await must(teacher.from("attendance").select("*").eq("session_id", sessionId));
    expect((await switchScheduleAction(schedules[3].id, { date: "2026-12-01", time: "23:30" })).ok).toBe(true);
    expect((await switchScheduleAction(schedules[3].id, { date: "2026-12-01", time: "23:30" })).ok).toBe(true);
    const lesson = await must(teacher.from("sessions").select("*").eq("id", sessionId).single());
    expect(lesson).toMatchObject({ status: "completed", session_date: "2026-12-01", started_at: "2026-12-01T16:30:00+00:00",
      ended_at: "2026-12-01T18:00:00+00:00", material: "Pecahan", homework: "Latihan pecahan", score: 85 });
    expect(await must(teacher.from("attendance").select("*").eq("session_id", sessionId))).toEqual(attendance);
    expect((await due(pkg.id, pkg.invoice_id!))[0].sessions_used).toBe(1);
    expect((await due(pkg.id, pkg.invoice_id!))[1].due_date).toBe("2026-12-01");
  });

  it("cancels a completed meeting once, reverses its actual deduction and preserves material and another month's package", async () => {
    const { sid, pkg, schedules } = await fixture("QA Batal Selesai");
    expect((await addPackageAction(sid, input("QA Batal Selesai", "2026-12-01"))).ok).toBe(true);
    const other = await must(teacher.from("student_packages").select("*").eq("student_id", sid).neq("id", pkg.id).single());
    const otherBefore = await due(other.id, other.invoice_id!);
    const completed = await completeSessionAction(schedules[3].id, { attendance: "hadir", duration_minutes: 90, material: "Materi tetap", score: 90 });
    expect(completed.ok).toBe(true);
    // Later policy/attendance edits must not change which deduction is reversed.
    await must(teacher.from("settings").update({ deduct_package_policy: "hadir_only" }).eq("user_id", uid!).select("id"));
    await must(teacher.from("attendance").update({ status: "izin" }).eq("session_id", completed.data!.sessionId).select("id"));
    const result = await cancelScheduleAction(schedules[3].id, "Dibatalkan setelah selesai");
    expect(result.ok, result.error).toBe(true);
    expect(await due(pkg.id, pkg.invoice_id!)).toEqual([
      { start_date: "2026-11-15", total_sessions: 3, sessions_used: 0, price: 150000, status: "active" },
      { due_date: "2026-11-15", amount: 150000, status: "unpaid" },
    ]);
    expect(await due(other.id, other.invoice_id!)).toEqual(otherBefore);
    expect(await must(teacher.from("sessions").select("status,material,score").eq("id", completed.data!.sessionId).single()))
      .toEqual({ status: "cancelled", material: "Materi tetap", score: 90 });
    expect((await must(teacher.from("attendance").select("status").eq("session_id", completed.data!.sessionId).single())).status).toBe("dibatalkan_guru");
    expect((await saveSessionForScheduleAction(schedules[3].id, { material: "Tidak boleh mengaktifkan kembali", score: null })).ok).toBe(false);
    expect((await updateSessionAction(completed.data!.sessionId, { duration_minutes: 90, material: "Tidak boleh mengaktifkan kembali", score: null })).ok).toBe(false);
    const after = await due(pkg.id, pkg.invoice_id!);
    expect((await cancelScheduleAction(schedules[3].id)).ok).toBe(false);
    expect(await due(pkg.id, pkg.invoice_id!)).toEqual(after);
    expect((await switchScheduleAction(schedules[3].id, { date: "2026-12-30", time: "16:00" })).ok).toBe(false);
    expect(await due(pkg.id, pkg.invoice_id!)).toEqual(after);
  });

  it("cancels a non-deducted completed lesson without removing another lesson's usage, even after policy changes", async () => {
    const { pkg, schedules } = await fixture("QA Batal Tanpa Potongan");
    await must(teacher.from("settings").update({ deduct_package_policy: "hadir_only" }).eq("user_id", uid!).select("id"));
    expect((await completeSessionAction(schedules[0].id, { attendance: "hadir", duration_minutes: 90 })).ok).toBe(true);
    expect((await completeSessionAction(schedules[1].id, { attendance: "alpha", duration_minutes: 90 })).ok).toBe(true);
    await must(teacher.from("settings").update({ deduct_package_policy: "all_except_cancelled" }).eq("user_id", uid!).select("id"));
    expect((await cancelScheduleAction(schedules[1].id)).ok).toBe(true);
    expect((await due(pkg.id, pkg.invoice_id!))[0]).toMatchObject({ sessions_used: 1, total_sessions: 3, price: 150000 });
    await must(teacher.from("settings").update({ deduct_package_policy: "hadir_only" }).eq("user_id", uid!).select("id"));
  });

  it("allows cancellation of a historical completed meeting without a lesson or deduction", async () => {
    const { pkg, schedules } = await fixture("QA Selesai Otomatis", "2026-09-01");
    expect(schedules[3].status).toBe("completed");
    expect((await cancelScheduleAction(schedules[3].id)).ok).toBe(true);
    expect((await due(pkg.id, pkg.invoice_id!))[0]).toMatchObject({ total_sessions: 3, sessions_used: 0, start_date: "2026-09-20" });
  });

  it("cancels the final completed meeting of an exhausted package, producing a zero bill and usage", async () => {
    const { pkg, schedules } = await fixture("QA Paket Selesai Terakhir", undefined, 1);
    expect((await completeSessionAction(schedules[0].id, { attendance: "hadir", duration_minutes: 90 })).ok).toBe(true);
    await must(teacher.from("student_packages").update({ status: "completed" }).eq("id", pkg.id).select("id"));
    expect((await cancelScheduleAction(schedules[0].id)).ok).toBe(true);
    expect((await due(pkg.id, pkg.invoice_id!))[0]).toMatchObject({ total_sessions: 0, sessions_used: 0, price: 0, status: "cancelled" });
    expect((await due(pkg.id, pkg.invoice_id!))[1]).toMatchObject({ amount: 0, status: "paid" });
  });

  it("rolls back completed cancellation if it would make the bill smaller than received payments", async () => {
    const { sid, pkg, schedules } = await fixture("QA Selesai Lunas");
    const completed = await completeSessionAction(schedules[0].id, { attendance: "hadir", duration_minutes: 90, material: "Tetap selesai" });
    expect(completed.ok).toBe(true);
    expect((await recordPaymentAction({ student_id: sid, invoice_id: pkg.invoice_id, type: "package", amount: "200000",
      payment_date: "2026-11-01", method: "cash" })).ok).toBe(true);
    const before = await due(pkg.id, pkg.invoice_id!);
    expect((await cancelScheduleAction(schedules[0].id)).ok).toBe(false);
    expect(await due(pkg.id, pkg.invoice_id!)).toEqual(before);
    expect((await must(teacher.from("sessions").select("status").eq("id", completed.data!.sessionId).single())).status).toBe("completed");
    expect((await must(teacher.from("attendance").select("status").eq("session_id", completed.data!.sessionId).single())).status).toBe("hadir");
  });

  it("keeps the last remaining deadline correct when moving and cancelling concurrently", async () => {
    const { pkg, schedules } = await fixture("QA Mutasi Bersamaan");
    const results = await Promise.all([
      switchScheduleAction(schedules[3].id, { date: "2026-12-01", time: "16:00" }),
      cancelScheduleAction(schedules[3].id),
    ]);
    expect(results[1].ok, results[1].error).toBe(true);
    expect((await due(pkg.id, pkg.invoice_id!))[1]).toMatchObject({ due_date: "2026-11-15", amount: 150000 });
    expect((await must(teacher.from("schedules").select("status").eq("id", schedules[3].id).single())).status).toBe("cancelled");
  });

  it("does not apply a manual/unlinked completed meeting to an unrelated package", async () => {
    const { sid, pkg, schedules } = await fixture("QA Jadwal Tanpa Paket");
    const row = await must(teacher.from("schedules").insert({ user_id: uid!, student_id: sid, subject_id: subject,
      start_at: "2026-09-01T09:00:00Z", end_at: "2026-09-01T10:30:00Z", status: "completed" }).select("id").single());
    const baseline = await due(pkg.id, pkg.invoice_id!);
    expect((await switchScheduleAction(row.id, { date: "2026-12-30", time: "16:00" })).ok).toBe(true);
    expect(await due(pkg.id, pkg.invoice_id!)).toEqual(baseline);
    expect((await cancelScheduleAction(row.id)).ok).toBe(true);
    expect(await due(pkg.id, pkg.invoice_id!)).toEqual(baseline);
    expect(await must(teacher.from("schedules").select("*").eq("package_id", pkg.id).order("start_at"))).toEqual(schedules);
  });

  it("resolves unambiguous historical deductions, and refuses to guess partial legacy usage", async () => {
    const { pkg, schedules } = await fixture("QA Potongan Lama");
    for (const schedule of schedules.slice(0, 2)) {
      const result = await completeSessionAction(schedule.id, { attendance: "hadir", duration_minutes: 90 });
      expect(result.ok).toBe(true);
      await must(service.from("sessions").update({ package_deduction_recorded: false, deducted_package_id: null })
        .eq("id", result.data!.sessionId).select("id"));
    }
    // Simulate an old manually adjusted counter, where the aggregate no longer identifies which lesson was counted.
    await must(teacher.from("student_packages").update({ sessions_used: 1 }).eq("id", pkg.id).select("id"));
    const baseline = await due(pkg.id, pkg.invoice_id!);
    const refused = await cancelScheduleAction(schedules[0].id);
    expect(refused.ok).toBe(false);
    expect(refused.error).toContain("Pemakaian paket lama");
    expect(await due(pkg.id, pkg.invoice_id!)).toEqual(baseline);
    await must(teacher.from("student_packages").update({ sessions_used: 2 }).eq("id", pkg.id).select("id"));
    expect((await cancelScheduleAction(schedules[0].id)).ok).toBe(true);
    expect((await due(pkg.id, pkg.invoice_id!))[0]).toMatchObject({ sessions_used: 1, total_sessions: 3 });
  });
});

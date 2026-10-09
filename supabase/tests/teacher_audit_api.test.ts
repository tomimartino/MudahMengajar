// Opt-in regression suite against the linked Supabase project. Creates disposable fixtures, never changes customer records.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
const runtime = vi.hoisted(() => ({ client: null as SupabaseClient<Database> | null, admin: null as SupabaseClient<Database> | null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => runtime.client! }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => runtime.admin }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { createStudentAction, addPackageAction, setStudentStatusAction, updateStudentAction } from "@/lib/actions/students";
import { cancelScheduleAction } from "@/lib/actions/schedule";
import { completeSessionAction, updateSessionAction } from "@/lib/actions/sessions";
import { recordPaymentAction } from "@/lib/actions/payments";
import { saveLearningAction, setHomeworkStatusAction, deleteLearningAction } from "@/lib/actions/learning";
import { updatePortfolioAction, createExperienceAction, createAchievementAction, updateExperienceAction, deleteExperienceAction, updateAchievementAction, deleteAchievementAction } from "@/lib/actions/profile";
import { uploadAvatarAction } from "@/lib/actions/avatar";
import { buildReport } from "@/lib/reports/queries";
import { loadBillingLedger } from "@/lib/finance/data";
import { aggregateInvoiceMonthly, aggregateMonthly } from "@/lib/finance/queries";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter(l => /^[\w]+=/.test(l)).map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")]; }));
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options);
const teacher = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
let uid = "", subject = "";
const evidence: Record<string, unknown>[] = [];
async function must<T extends { data: unknown; error: { message: string } | null }>(q: PromiseLike<T>): Promise<NonNullable<T["data"]>> {
  const r = await q; if (r.error) throw new Error(r.error.message); if (r.data == null) throw new Error("No data"); return r.data as NonNullable<T["data"]>;
}
function input(name: string, start = "2026-11-01") { return { full_name: name, school_level: "SD", grade_level: "4", status: "active", learning_mode: "offline", billing_type: "package", package_sessions: "4", package_per_session_rate: "50000", package_price: "200000", subject_ids: [subject], schedule_start_date: start, schedule_times: [{ day: 1, start_time: "16:00" }] }; }
async function student(name: string, start?: string) { const r = await createStudentAction(input(name, start)); expect(r.ok, r.error).toBe(true); return r.data!.id; }
beforeAll(async () => {
  const creds = { email: `qa-full-audit-${randomUUID()}@example.invalid`, password: randomBytes(28).toString("base64url") };
  const created = await must(service.auth.admin.createUser({ ...creds, email_confirm: true, user_metadata: { full_name: "QA Audit" } })); uid = created.user!.id;
  await must(teacher.auth.signInWithPassword(creds)); runtime.client = teacher;
  runtime.admin = service;
  await must(service.from("profiles").update({ onboarding_completed: true, timezone: "Asia/Jakarta" }).eq("id", uid).select("id"));
  subject = (await must(teacher.from("subjects").insert({ user_id: uid, name: "Matematika QA" }).select("id").single())).id;
});
afterAll(async () => {
  try { await teacher.auth.signOut({ scope: "local" }); } finally {
    if (uid) { const r = await service.auth.admin.deleteUser(uid); if (r.error) throw new Error("Fixture cleanup failed"); }
    if (process.env.QA_AUDIT_EVIDENCE_FILE) writeFileSync(process.env.QA_AUDIT_EVIDENCE_FILE, JSON.stringify({ disposableFixturesCleaned: true, evidence }, null, 2));
  }
});
describe("full feature audit using disposable teacher", () => {
  it("per-session and monthly billing still save the same forms and schedules", async () => {
    const perSessionInput = { ...input("QA Per Pertemuan"), billing_type: "per_session", per_session_rate: "50000", schedule_times: [] };
    const perSession = await createStudentAction(perSessionInput);
    expect(perSession.ok, perSession.error).toBe(true);
    expect((await must(teacher.from("students").select("billing_type,per_session_rate").eq("id", perSession.data!.id).single())))
      .toEqual({ billing_type: "per_session", per_session_rate: 50000 });
    expect(await must(teacher.from("invoices").select("id").eq("student_id", perSession.data!.id))).toHaveLength(0);
    expect((await addPackageAction(perSession.data!.id, { ...perSessionInput, per_session_rate: "60000" })).ok).toBe(true);
    const monthly = await createStudentAction({ ...input("QA Bulanan", "2026-09-01"), billing_type: "monthly", monthly_fee: "300000", monthly_due_day: "30",
      schedule_times: [{ day: 1, start_time: "14:00" }, { day: 3, start_time: "14:00" }] });
    expect(monthly.ok, monthly.error).toBe(true);
    expect(await must(teacher.from("invoices").select("amount,due_date,type").eq("student_id", monthly.data!.id).single()))
      .toEqual({ amount: 300000, due_date: "2026-09-30", type: "monthly" });
    expect(await must(teacher.from("schedules").select("id").eq("student_id", monthly.data!.id))).toHaveLength(9);
  });
  it("last-session cancellation clears the charge atomically and cannot run twice", async () => {
    const created = await createStudentAction({ ...input("QA Paket Terakhir"), package_sessions: "1", package_price: "50000" });
    expect(created.ok, created.error).toBe(true);
    const pkg = await must(teacher.from("student_packages").select("id,invoice_id").eq("student_id", created.data!.id).single());
    const schedule = await must(teacher.from("schedules").select("id").eq("package_id", pkg.id).single());
    expect((await cancelScheduleAction(schedule.id, "Uji pembatalan terakhir")).ok).toBe(true);
    expect(await must(teacher.from("student_packages").select("total_sessions,price,status").eq("id", pkg.id).single()))
      .toEqual({ total_sessions: 0, price: 0, status: "cancelled" });
    expect(await must(teacher.from("invoices").select("amount,status").eq("id", pkg.invoice_id!).single()))
      .toEqual({ amount: 0, status: "paid" });
    expect((await cancelScheduleAction(schedule.id)).ok).toBe(false);
  });
  it("cancellation cannot silently reduce a bill below money already received", async () => {
    const sid = await student("QA Pembatalan Lunas");
    const pkg = await must(teacher.from("student_packages").select("id,invoice_id,total_sessions,price").eq("student_id", sid).single());
    const schedule = (await must(teacher.from("schedules").select("id,status").eq("package_id", pkg.id).order("start_at")))[0];
    expect((await recordPaymentAction({ student_id: sid, invoice_id: pkg.invoice_id, type: "package", amount: "200000", payment_date: "2026-11-01", method: "cash" })).ok).toBe(true);
    expect((await cancelScheduleAction(schedule.id)).ok).toBe(false);
    expect(await must(teacher.from("schedules").select("id,status").eq("id", schedule.id).single())).toEqual(schedule);
    expect(await must(teacher.from("student_packages").select("id,invoice_id,total_sessions,price").eq("id", pkg.id).single())).toEqual(pkg);
  });
  it("concurrent completion records exactly one session and one package deduction", async () => {
    const sid = await student("QA Selesai Bersamaan");
    const pkg = await must(teacher.from("student_packages").select("id").eq("student_id", sid).single());
    const schedule = (await must(teacher.from("schedules").select("id").eq("package_id", pkg.id).order("start_at")))[0];
    const results = await Promise.all([1,2].map(() => completeSessionAction(schedule.id, { attendance: "hadir", duration_minutes: 90 })));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await must(teacher.from("sessions").select("id").eq("schedule_id", schedule.id))).toHaveLength(1);
    expect((await must(teacher.from("student_packages").select("sessions_used").eq("id", pkg.id).single())).sessions_used).toBe(1);
  });
  it("a late schedule failure rolls back the parent, student, invoice and package", async () => {
    const before = await Promise.all(["parents", "students", "invoices", "student_packages"].map((table) =>
      must(teacher.from(table as "students").select("id").order("id"))));
    const result = await teacher.rpc("save_student_bundle", {
      p_data: { ...input("QA Rollback Akhir"), parent_name: "Wali Rollback", parent_whatsapp: "", per_session_rate: null,
        monthly_fee: null, monthly_due_day: null, package_price: 200000, package_sessions: 4, package_per_session_rate: 50000 },
      p_due_date: "2026-11-30", p_period_label: "November 2026", p_package_settings: {},
      p_schedules: [{ start_at: "2026-11-01T10:00:00Z", end_at: "2026-11-01T09:00:00Z" }],
    });
    expect(result.error).toBeTruthy();
    const after = await Promise.all(["parents", "students", "invoices", "student_packages"].map((table) =>
      must(teacher.from(table as "students").select("id").order("id"))));
    expect(after).toEqual(before);
  });
  it("blank-phone identity edits preserve each family's own guardian", async () => {
    const a = await createStudentAction({ ...input("QA Edit Wali A"), parent_name: "Wali Edit A", parent_whatsapp: "" });
    const b = await createStudentAction({ ...input("QA Edit Wali B"), parent_name: "Wali Edit B", parent_whatsapp: "" });
    expect(a.ok).toBe(true); expect(b.ok).toBe(true);
    const original = await must(teacher.from("students").select("parent_id").eq("id", a.data!.id).single());
    expect((await updateStudentAction(a.data!.id, { ...input("QA Edit Wali A"), parent_name: "Wali A Diperbarui", parent_whatsapp: "" })).ok).toBe(true);
    const own = await must(teacher.from("students").select("parent_id,parents(name)").eq("id", a.data!.id).single());
    const other = await must(teacher.from("students").select("parent_id,parents(name)").eq("id", b.data!.id).single());
    expect(own.parent_id).toBe(original.parent_id);
    expect((own.parents as unknown as { name: string }).name).toBe("Wali A Diperbarui");
    expect((other.parents as unknown as { name: string }).name).toBe("Wali Edit B");
  });
  it("new write RPCs reject anonymous and missing/foreign targets", async () => {
    const anonymous = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
    expect((await anonymous.rpc("cancel_learning_schedule", { p_schedule_id: randomUUID() })).error).toBeTruthy();
    expect((await anonymous.rpc("save_student_bundle", { p_data: {}, p_due_date: "2026-11-01", p_period_label: "", p_package_settings: {}, p_schedules: [] })).error).toBeTruthy();
    expect((await teacher.rpc("update_student_identity", { p_student_id: randomUUID(), p_data: {} })).error).toBeTruthy();
  });
  it("profile CRUD and avatar image reach the public profile", async () => {
    const exp = { institution: "Lembaga Audit", role: "Guru", start_year: "2020", end_year: "2024", description: "Uji" };
    expect((await createExperienceAction(exp)).ok).toBe(true);
    const experience = await must(teacher.from("teaching_experiences").select("id").single());
    expect((await updateExperienceAction(experience.id, { ...exp, institution: "Lembaga Diperbarui" })).ok).toBe(true);
    expect((await createAchievementAction({ title: "Sertifikat Audit", year: "2024" })).ok).toBe(true);
    const certificate = await must(teacher.from("achievements").select("id").single());
    expect((await updateAchievementAction(certificate.id, { title: "Sertifikat Diperbarui", year: "2025" })).ok).toBe(true);
    const paths: string[] = [];
    try {
      const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/n1cAAAAASUVORK5CYII=", "base64");
      const form = new FormData(); form.set("file", new File([bytes], "audit.png", { type: "image/png" }));
      const uploaded = await uploadAvatarAction(form); expect(uploaded.ok, uploaded.error).toBe(true);
      const avatarUrl = uploaded.data!.url; const path = avatarUrl.split("/avatars/")[1].split("?")[0]; paths.push(path);
      const image = await fetch(avatarUrl); expect(image.ok).toBe(true); expect((await image.arrayBuffer()).byteLength).toBe(bytes.length);
      const pub = await must(teacher.rpc("get_public_profile", { p_ident: uid })) as unknown as { avatar_url: string; experiences: { institution: string }[]; achievements: { title: string }[] };
      expect(pub.avatar_url).toBe(avatarUrl); expect(pub.experiences[0].institution).toBe("Lembaga Diperbarui"); expect(pub.achievements[0].title).toBe("Sertifikat Diperbarui");
      expect((await deleteExperienceAction(experience.id)).ok).toBe(true); expect((await deleteAchievementAction(certificate.id)).ok).toBe(true);
      expect(await must(teacher.from("teaching_experiences").select("id"))).toHaveLength(0); expect(await must(teacher.from("achievements").select("id"))).toHaveLength(0);
      evidence.push({ case: "profile_crud_avatar", status: "passed" });
    } finally { if (paths.length) await service.storage.from("avatars").remove(paths); }
  });
  it("file attachments upload, download privately and clean up after deletion", async () => {
    const path = `${uid}/${randomUUID()}.txt`;
    const bytes = new TextEncoder().encode("Isi lampiran QA sementara");
    try {
      await must(teacher.storage.from("teaching-files").upload(path, bytes, { contentType: "text/plain" }));
      const result = await saveLearningAction("material", { title: "Lampiran QA", content: "Materi uji", files: [{ path, name: "audit.txt", size: bytes.length }] });
      expect(result.ok, result.error).toBe(true);
      const row = await must(teacher.from("learning_materials").select("id,files").eq("title", "Lampiran QA").single());
      const signed = await must(teacher.storage.from("teaching-files").createSignedUrl(path, 60));
      const response = await fetch(signed.signedUrl);
      expect(response.ok).toBe(true);
      expect(await response.text()).toBe("Isi lampiran QA sementara");
      const anonymous = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
      const denied = await anonymous.storage.from("teaching-files").download(path);
      expect(denied.error).toBeTruthy();
      expect((await deleteLearningAction("material", row.id)).ok).toBe(true);
      expect((await teacher.storage.from("teaching-files").download(path)).error).toBeTruthy();
      evidence.push({ case: "file_attachment", status: "passed", anonymousAccess: "denied", deletedFile: "removed" });
    } finally { await service.storage.from("teaching-files").remove([path]); }
  });
  it("cancelling a schedule changes its own package, never the newest unrelated package", async () => {
    const sid = await student("QA Batal Paket");
    const first = await must(teacher.from("student_packages").select("*").eq("student_id", sid).single());
    const schedule = (await must(teacher.from("schedules").select("id").eq("package_id", first.id).order("start_at")))[0];
    expect((await addPackageAction(sid, input("QA Batal Paket", "2026-12-01"))).ok).toBe(true);
    const second = await must(teacher.from("student_packages").select("*").eq("student_id", sid).neq("id", first.id).single());
    const result = await cancelScheduleAction(schedule.id);
    expect(result.ok, result.error).toBe(true);
    const actual = await must(teacher.from("student_packages").select("id,total_sessions,price").eq("student_id", sid).order("start_date"));
    evidence.push({ case: "cancel_own_package", expected: [3,4], actual: actual.map(p => p.total_sessions), prices: actual.map(p => p.price) });
    expect(actual.find(p => p.id === first.id)?.total_sessions).toBe(3);
    expect(actual.find(p => p.id === second.id)?.total_sessions).toBe(4);
  });
  it("completing a schedule consumes its own package and syncs PR + due date", async () => {
    const sid = await student("QA Selesai Paket");
    const first = await must(teacher.from("student_packages").select("*").eq("student_id", sid).single());
    const schedule = (await must(teacher.from("schedules").select("id").eq("package_id", first.id).order("start_at")))[0];
    expect((await addPackageAction(sid, input("QA Selesai Paket", "2026-12-01"))).ok).toBe(true);
    const result = await completeSessionAction(schedule.id, { attendance: "hadir", duration_minutes: 90, material: "Pecahan QA", homework: "Latihan pecahan QA", homework_due_date: "2026-11-05", score: 80 });
    expect(result.ok, result.error).toBe(true);
    const task = await must(teacher.from("homework_tasks").select("id,description,due_date").eq("session_id", result.data!.sessionId).single());
    expect(task.description).toBe("Latihan pecahan QA"); expect(task.due_date).toBe("2026-11-05");
    expect((await setHomeworkStatusAction(task.id, "completed")).ok).toBe(true);
    const actual = await must(teacher.from("student_packages").select("id,sessions_used").eq("student_id", sid).order("start_date"));
    evidence.push({ case: "complete_own_package", expected: [1,0], actual: actual.map(p => p.sessions_used), homeworkSync: "passed" });
    expect(actual.find(p => p.id === first.id)?.sessions_used).toBe(1);
  });
  it("parents without WhatsApp remain separate instead of overwriting earlier students", async () => {
    const a = await createStudentAction({ ...input("QA Wali A"), parent_name: "Wali A", parent_whatsapp: "" });
    const b = await createStudentAction({ ...input("QA Wali B"), parent_name: "Wali B", parent_whatsapp: "" });
    expect(a.ok, a.error).toBe(true); expect(b.ok, b.error).toBe(true);
    const rows = await must(teacher.from("students").select("full_name,parent_id,parents(name)").in("id", [a.data!.id,b.data!.id]).order("full_name"));
    evidence.push({ case: "parent_without_phone", expected: ["Wali A", "Wali B"], actual: rows.map(r => (r.parents as unknown as { name: string }).name), sameParent: rows[0].parent_id === rows[1].parent_id });
    expect((rows[0].parents as unknown as { name: string }).name).toBe("Wali A");
    expect(rows[0].parent_id).not.toBe(rows[1].parent_id);
  });
  it("student report limits attendance to its chosen date range", async () => {
    const sid = await student("QA Kehadiran Laporan");
    for (const date of ["2026-09-10","2026-10-10"]) {
      const s = await must(teacher.from("sessions").insert({ user_id: uid, student_id: sid, subject_id: subject, session_date: date, status: "completed", duration_minutes: 90 }).select("id").single());
      await must(teacher.from("attendance").insert({ user_id: uid, student_id: sid, session_id: s.id, status: "hadir" }).select("id"));
    }
    const r = await buildReport(teacher, uid, "students", { from: "2026-10-01", to: "2026-10-31", student: sid });
    evidence.push({ case: "report_attendance_date_filter", expected: { sessions: 1, hadir: 1, percentage: 100 }, actual: r.rows[0] });
    expect(r.rows[0].Hadir).toBe(1); expect(r.rows[0]["Kehadiran (%)"]).toBe(100);
  });
  it("student report subtracts partial payments from unpaid balance", async () => {
    const sid = await student("QA Sisa Tagihan", "2026-09-01");
    const invoice = await must(teacher.from("invoices").select("id").eq("student_id", sid).single());
    const paid = await recordPaymentAction({ student_id: sid, invoice_id: invoice.id, type: "package", amount: "50000", payment_date: "2026-10-09", method: "cash" }); expect(paid.ok, paid.error).toBe(true);
    const r = await buildReport(teacher, uid, "students", { from: "2026-09-01", to: "2026-09-30", student: sid });
    evidence.push({ case: "report_partial_balance", expected: 150000, actual: r.rows[0]["Tagihan Belum Lunas"] });
    expect(r.rows[0]["Tagihan Belum Lunas"]).toBe(150000);
    const ledger = await loadBillingLedger(teacher, uid);
    expect(aggregateMonthly(ledger.payments.filter(p => p.student_id === sid)).get("2026-10")?.total).toBe(50000);
    expect(aggregateInvoiceMonthly(ledger.invoices.filter(i => i.student_id === sid)).get("2026-09")).toBe(200000);
  });
  it("failed student creation rolls back its partial records", async () => {
    const name = "QA Gagal Buat";
    const r = await createStudentAction({ ...input(name), package_price: "0" });
    expect(r.ok).toBe(false);
    const rows = await must(teacher.from("students").select("id").eq("full_name", name));
    evidence.push({ case: "student_creation_rollback", expected: 0, actual: rows.length, actionError: r.error });
    expect(rows).toHaveLength(0);
  });
  it("deactivation and reactivation preserve future schedules", async () => {
    const sid = await student("QA Nonaktif");
    const before = await must(teacher.from("schedules").select("id").eq("student_id", sid));
    expect((await setStudentStatusAction(sid, "inactive")).ok).toBe(true);
    expect((await setStudentStatusAction(sid, "active")).ok).toBe(true);
    const after = await must(teacher.from("schedules").select("id").eq("student_id", sid));
    evidence.push({ case: "deactivation_schedule_loss", expected: before.length, actual: after.length });
    expect(after).toHaveLength(before.length);
  });
  it("profile choices remove a deselected unused subject from the public profile", async () => {
    const unused = await must(teacher.from("subjects").insert({ user_id: uid, name: "Bahasa QA Tidak Dipilih" }).select("id").single());
    const r = await updatePortfolioAction({ full_name: "Guru QA", whatsapp: "", timezone: "Asia/Jakarta", subjects: ["Matematika QA"], teaching_levels: ["SD"], learning_mode: "offline" });
    expect(r.ok, r.error).toBe(true);
    const pub = await must(teacher.rpc("get_public_profile", { p_ident: uid })) as unknown as { subjects: string[] };
    evidence.push({ case: "profile_deselected_subject", expected: ["Matematika QA"], actual: pub.subjects });
    expect(pub.subjects).not.toContain("Bahasa QA Tidak Dipilih");
    // Referenced below so type checking keeps this fixture explicit.
    expect(unused.id).toBeTruthy();
  });
  it("profile experience and achievement creation persist valid values", async () => {
    expect((await createExperienceAction({ institution: "Lembaga QA", role: "Guru", start_year: "2020", end_year: "2024", description: "Pengalaman uji" })).ok).toBe(true);
    expect((await createAchievementAction({ title: "Sertifikat QA", year: "2024", description: "Sertifikat uji" })).ok).toBe(true);
    const pub = await must(teacher.rpc("get_public_profile", { p_ident: uid })) as unknown as { experiences: unknown[]; achievements: unknown[] };
    expect(pub.experiences).toHaveLength(1); expect(pub.achievements).toHaveLength(1);
    evidence.push({ case: "profile_experience_achievement", status: "passed" });
  });
  it("manual materials and assignments can be saved and updated", async () => {
    const sid = await student("QA Tugas Manual");
    expect((await saveLearningAction("material", { title: "Koleksi QA", content: "Isi materi QA" })).ok).toBe(true);
    expect((await saveLearningAction("homework", { student_id: sid, title: "PR Manual QA", description: "Latihan", due_date: "2026-11-10" })).ok).toBe(true);
    const task = await must(teacher.from("homework_tasks").select("id").eq("student_id", sid).single());
    expect((await setHomeworkStatusAction(task.id, "completed")).ok).toBe(true);
    expect((await must(teacher.from("homework_tasks").select("status").eq("id", task.id).single())).status).toBe("completed");
    evidence.push({ case: "manual_material_homework", status: "passed" });
  });
  it("editing a missing session cannot report a successful save", async () => {
    const r = await updateSessionAction(randomUUID(), { duration_minutes: 90, material: "QA", score: null });
    evidence.push({ case: "missing_session_false_success", expected: false, actual: r.ok });
    expect(r.ok).toBe(false);
  });
});

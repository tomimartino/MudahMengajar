// Opt-in integration check: use the separate config below, never customer data.
// npx vitest run --config supabase/tests/integration.config.mts package_schedule_api
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const runtime = vi.hoisted(() => ({ client: null as SupabaseClient<Database> | null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => runtime.client! }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { addPackageAction, createStudentAction, updateStudentAction } from "@/lib/actions/students";
import { getEditPackageSetupAction, listEditablePackagesAction, updatePackageAction } from "@/lib/actions/package-edit";
import { editedPackageDueDate } from "@/lib/utils/package-edit-schedule";
import { getPackageFormSetupAction } from "@/lib/actions/package-setup";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter((line) => /^[\w]+=/.test(line)).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")];
  }));
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options);
const teacher = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
let userId: string | undefined;
let subjectId: string;

async function must<R extends { data: unknown; error: { code?: string; status?: number } | null }>(
  request: PromiseLike<R>,
): Promise<NonNullable<R["data"]>> {
  const result = await request;
  if (result.error) throw new Error(`Package integration failed (${result.error.code ?? result.error.status ?? "unknown"})`);
  if (result.data == null) throw new Error("Package integration returned no data");
  return result.data as NonNullable<R["data"]>;
}

beforeAll(async () => {
  const credentials = { email: `qa-package-${randomUUID()}@example.invalid`, password: randomBytes(28).toString("base64url") };
  const created = await must(service.auth.admin.createUser({ ...credentials, email_confirm: true,
    user_metadata: { full_name: "Uji Jadwal Paket" } }));
  userId = created.user!.id;
  await must(teacher.auth.signInWithPassword(credentials));
  await must(service.from("profiles").update({ onboarding_completed: true, timezone: "Asia/Jakarta" }).eq("id", userId).select("id"));
  const subject = await must(teacher.from("subjects").insert({ user_id: userId, name: "Mapel Uji Paket" }).select("id").single());
  subjectId = subject.id;
  runtime.client = teacher;
});

afterAll(async () => {
  await teacher.auth.signOut();
  if (userId) await must(service.auth.admin.deleteUser(userId));
});

describe("real package action preserves other months", () => {
  it("creates and edits a group without a headcount, keeping one unchanged bill", async () => {
    const input = { full_name: "Rombel Uji Tanpa Jumlah", teaching_type: "group", school_level: "SD", grade_level: "4",
      learning_mode: "offline", status: "active", billing_type: "package", package_sessions: "4",
      package_per_session_rate: "75000", package_price: "300000", subject_ids: [subjectId],
      schedule_start_date: "2026-11-01", schedule_times: [{ day: 7, start_time: "16:00" }] };
    const created = await createStudentAction(input);
    expect(created.ok, created.error).toBe(true);
    const id = created.data!.id;
    const identity = () => must(teacher.from("students").select("teaching_type,group_size").eq("id", id).single());
    expect(await identity()).toEqual({ teaching_type: "group", group_size: null });
    const bills = await must(teacher.from("invoices").select("*").eq("student_id", id));
    expect(bills).toHaveLength(1);
    expect(Number(bills[0].amount)).toBe(300000);
    expect((await updateStudentAction(id, { ...input, group_size: "8" })).ok).toBe(true);
    expect((await updateStudentAction(id, { ...input, group_size: "  " })).ok).toBe(true);
    expect(await identity()).toEqual({ teaching_type: "group", group_size: null });
    expect(await must(teacher.from("invoices").select("*").eq("student_id", id))).toEqual(bills);
    expect((await addPackageAction(id, { ...input, schedule_start_date: "2026-12-01" })).ok).toBe(true);
    expect(await identity()).toEqual({ teaching_type: "group", group_size: null });
    expect(await must(teacher.from("invoices").select("id").eq("student_id", id))).toHaveLength(2);
  });
  it("creates one group, one invoice, and one set of meetings; adding a package preserves its group identity", async () => {
    const input = { full_name: "Rombel Uji Kelas 4A", teaching_type: "group", group_size: "6",
      school_level: "SD", grade_level: "4", learning_mode: "offline", status: "active",
      parent_name: "Penanggung Jawab Uji", parent_whatsapp: "081234500001", billing_type: "package",
      package_sessions: "4", package_per_session_rate: "75000", package_price: "300000",
      subject_ids: [subjectId], schedule_start_date: "2026-11-01", schedule_times: [{ day: 7, start_time: "16:00" }] };
    const created = await createStudentAction(input);
    expect(created).toMatchObject({ ok: true });
    const id = created.data!.id;
    const row = await must(teacher.from("students").select("teaching_type,group_size,parent_id").eq("id", id).single());
    expect(row).toMatchObject({ teaching_type: "group", group_size: 6 });
    expect(row.parent_id).not.toBeNull();
    const invoices = await must(teacher.from("invoices").select("amount,due_date").eq("student_id", id));
    expect(invoices).toHaveLength(1);
    expect(Number(invoices[0].amount)).toBe(300000);
    expect(invoices[0].due_date).toBe("2026-11-22");
    const before = await must(teacher.from("schedules").select("id,start_at").eq("student_id", id).order("start_at"));
    expect(before).toHaveLength(4);
    const setup = await getPackageFormSetupAction(id);
    expect(setup.data?.initial).toMatchObject({ id, teaching_type: "group", group_size: 6 });
    expect((await addPackageAction(id, { ...input, teaching_type: "private", group_size: "100", schedule_start_date: "2026-12-01" })).ok).toBe(true);
    expect(await must(teacher.from("students").select("teaching_type,group_size").eq("id", id).single()))
      .toEqual({ teaching_type: "group", group_size: 6 });
    const after = await must(teacher.from("schedules").select("id,start_at").eq("student_id", id).order("start_at"));
    expect(after).toHaveLength(8);
    expect(after.slice(0, 4)).toEqual(before);
    const payments = await must(teacher.from("invoices").select("amount").eq("student_id", id));
    expect(payments).toHaveLength(2);
    expect(payments.every((invoice) => Number(invoice.amount) === 300000)).toBe(true);
    expect((await createStudentAction({ ...input, full_name: "  ROMBEL   UJI KELAS 4A " })).ok).toBe(false);
    expect(await must(teacher.from("invoices").select("amount").eq("student_id", id))).toHaveLength(2);
  });

  it("resizes a group without changing invoices, and rejects invalid sizes and identity type changes", async () => {
    const input = { full_name: "Rombel Uji Edit", teaching_type: "group", group_size: "4", school_level: "SD", grade_level: "4",
      learning_mode: "offline", status: "active", billing_type: "monthly", monthly_fee: "400000", monthly_due_day: "30",
      subject_ids: [subjectId], schedule_start_date: "2026-11-01", schedule_times: [] };
    const created = await createStudentAction(input);
    expect(created.ok).toBe(true);
    const id = created.data!.id;
    const baseline = await must(teacher.from("invoices").select("*").eq("student_id", id));
    expect(baseline).toHaveLength(1);
    expect(Number(baseline[0].amount)).toBe(400000);
    expect((await updateStudentAction(id, { ...input, group_size: "8", monthly_fee: "900000" })).ok).toBe(true);
    expect(await must(teacher.from("invoices").select("*").eq("student_id", id))).toEqual(baseline);
    expect((await must(teacher.from("students").select("group_size").eq("id", id).single())).group_size).toBe(8);
    expect((await updateStudentAction(id, { ...input, group_size: "1" })).ok).toBe(false);
    expect((await updateStudentAction(id, { ...input, teaching_type: "private", group_size: "" })).ok).toBe(false);
    expect((await teacher.from("students").update({ group_size: 1 }).eq("id", id)).error?.code).toBe("23514");
    expect((await must(teacher.from("students").select("teaching_type,group_size").eq("id", id).single())))
      .toEqual({ teaching_type: "group", group_size: 8 });
  });

  it("identity edits cannot mutate learning, packages, schedules or invoices", async () => {
    const input = { full_name: "Murid Uji Identitas", school_level: "SD", grade_level: "4",
      learning_mode: "offline", status: "active", billing_type: "package", package_sessions: "4",
      package_per_session_rate: "50000", package_price: "200000", subject_ids: [subjectId],
      schedule_start_date: "2026-11-01", schedule_times: [{ day: 7, start_time: "16:00" }] };
    const created = await createStudentAction(input);
    expect(created.ok).toBe(true);
    const studentId = created.data!.id;
    const snapshot = async () => Promise.all([
      must(teacher.from("student_packages").select("*").eq("student_id", studentId).order("id")),
      must(teacher.from("schedules").select("*").eq("student_id", studentId).order("id")),
      must(teacher.from("invoices").select("*").eq("student_id", studentId).order("id")),
      must(teacher.from("student_subjects").select("*").eq("student_id", studentId).order("id")),
    ]);
    const before = await snapshot();
    expect((await updateStudentAction(studentId, { ...input, full_name: "Murid Uji Identitas Baru",
      school_name: "Sekolah Baru", learning_mode: "online", package_sessions: "100", subject_ids: [],
      schedule_start_date: "2027-01-01" })).ok).toBe(true);
    expect(await snapshot()).toEqual(before);
    const student = await must(teacher.from("students").select("full_name, school_name, learning_mode").eq("id", studentId).single());
    expect(student).toEqual({ full_name: "Murid Uji Identitas Baru", school_name: "Sekolah Baru", learning_mode: "offline" });
  });

  it("edits only the selected package, preserves history/payment, and rejects invalid or foreign edits", async () => {
    const input = { full_name: "Murid Uji Edit Paket", school_level: "SD", grade_level: "4",
      learning_mode: "offline", status: "active", billing_type: "package", package_sessions: "4",
      package_per_session_rate: "50000", package_price: "200000", subject_ids: [subjectId],
      schedule_start_date: "2026-11-01", schedule_times: [{ day: 7, start_time: "16:00" }] };
    const created = await createStudentAction(input);
    expect(created.ok).toBe(true);
    const studentId = created.data!.id;
    expect((await addPackageAction(studentId, { ...input, schedule_start_date: "2026-12-01" })).ok).toBe(true);
    const packages = await must(teacher.from("student_packages").select("*").eq("student_id", studentId).order("start_date"));
    const [selected, other] = packages;
    const ownSchedules = () => must(teacher.from("schedules").select("*").eq("package_id", selected.id).order("start_at"));
    const otherSnapshot = () => Promise.all([
      must(teacher.from("student_packages").select("*").eq("id", other.id).single()),
      must(teacher.from("schedules").select("*").eq("package_id", other.id).order("start_at")),
      must(teacher.from("invoices").select("*").eq("id", other.invoice_id!).single()),
    ]);
    const initial = await ownSchedules();
    await must(teacher.from("schedules").update({ status: "completed", notes: "Riwayat tetap" }).eq("id", initial[0].id).select("id"));
    await must(teacher.from("student_packages").update({ sessions_used: 1 }).eq("id", selected.id).select("id"));
    await must(teacher.rpc("record_payment", { p_student_id: studentId, p_invoice_id: selected.invoice_id!,
      p_amount: 100000, p_type: "package", p_payment_date: "2026-11-01", p_method: "cash" }));
    const protectedRow = (await ownSchedules())[0];
    const untouched = await otherSnapshot();
    const payments = await must(teacher.from("payments").select("*").eq("invoice_id", selected.invoice_id!).order("id"));
    const setup = await getEditPackageSetupAction(studentId, selected.id);
    expect(setup.ok).toBe(true);
    expect(setup.data!.initial).toMatchObject({ package_sessions: 4, package_price: "200000",
      schedule_start_date: "2026-11-01", schedule_times: [{ day: 7, start_time: "16:00" }] });
    expect((await listEditablePackagesAction(studentId)).data).toHaveLength(2);

    const edit = { ...input, package_sessions: "5", package_per_session_rate: "60000", package_price: "300000",
      schedule_times: [{ day: 3, start_time: "15:00" }] };
    const previewDue = editedPackageDueDate(setup.data!.packageSchedule!, 5, edit.schedule_start_date, edit.schedule_times, "Asia/Jakarta");
    const updated = await updatePackageAction(studentId, selected.id, edit);
    expect(updated, updated.error).toMatchObject({ ok: true });
    expect(await otherSnapshot()).toEqual(untouched);
    expect((await ownSchedules()).find((row) => row.id === protectedRow.id)).toEqual(protectedRow);
    expect(await ownSchedules()).toHaveLength(5);
    expect(await must(teacher.from("payments").select("*").eq("invoice_id", selected.invoice_id!).order("id"))).toEqual(payments);
    const invoice = await must(teacher.from("invoices").select("id,amount,due_date,status").eq("id", selected.invoice_id!).single());
    expect(invoice).toEqual({ id: selected.invoice_id, amount: 300000, due_date: "2026-11-25", status: "partial" });
    expect(invoice.due_date).toBe(previewDue);
    expect((await getEditPackageSetupAction(studentId, selected.id)).data!.initial.schedule_times).toEqual([{ day: 3, start_time: "15:00" }]);
    const beforeReject = await ownSchedules();
    expect((await updatePackageAction(studentId, selected.id, { ...edit, package_price: "50000" })).ok).toBe(false);
    expect((await updatePackageAction(studentId, selected.id, { ...edit, schedule_start_date: "2026-12-01",
      schedule_times: [{ day: 7, start_time: "16:00" }] })).ok).toBe(false);
    expect(await ownSchedules()).toEqual(beforeReject);
    const wrongStudent = randomUUID();
    expect((await getEditPackageSetupAction(wrongStudent, selected.id)).ok).toBe(false);
    expect((await updatePackageAction(wrongStudent, selected.id, edit)).ok).toBe(false);
    // Legacy packages whose invoice was removed stay editable without recreating a bill.
    const legacy = await createStudentAction({ ...input, full_name: "Murid Uji Paket Lama", schedule_times: [] });
    expect(legacy.ok).toBe(true);
    const legacyPkg = await must(teacher.from("student_packages").select("id,invoice_id").eq("student_id", legacy.data!.id).single());
    await must(teacher.from("invoices").delete().eq("id", legacyPkg.invoice_id!).select("id"));
    expect((await updatePackageAction(legacy.data!.id, legacyPkg.id, { ...input, schedule_times: [],
      package_per_session_rate: "60000", package_price: "240000" })).ok).toBe(true);
    expect(await must(teacher.from("invoices").select("id").eq("student_id", legacy.data!.id))).toEqual([]);
    await teacher.auth.signOut();
    expect((await updatePackageAction(studentId, selected.id, edit)).ok).toBe(false);
    // Restore auth for the other independent tests without retaining any fixture session.
    const link = await must(service.auth.admin.generateLink({ type: "magiclink", email: (await must(service.auth.admin.getUserById(userId!))).user!.email! }));
    await must(teacher.auth.verifyOtp({ token_hash: link.properties!.hashed_token, type: "magiclink" }));
  });

  it("adds September and November without deleting October; preserves completed/cancelled rows and avoids duplicates", async () => {
    const input = { full_name: "Murid Uji Pelestarian Jadwal", school_level: "SD", grade_level: "4",
      learning_mode: "offline", status: "active", billing_type: "package", package_sessions: "4",
      package_per_session_rate: "50000", package_price: "200000", subject_ids: [subjectId],
      schedule_start_date: "2026-10-01", schedule_times: [{ day: 7, start_time: "16:00" }] };
    const created = await createStudentAction(input);
    expect(created.ok).toBe(true);
    const studentId = created.data!.id;
    const schedules = () => must(teacher.from("schedules").select("*").eq("user_id", userId!)
      .eq("student_id", studentId).order("start_at"));
    const before = await schedules();
    expect(before).toHaveLength(4);
    const cancelled = before.find((row) => row.start_at.startsWith("2026-10-11"))!;
    await must(teacher.from("schedules").update({ status: "cancelled" }).eq("id", cancelled.id).eq("user_id", userId!).select("id"));
    const baseline = await schedules();

    const september = await addPackageAction(studentId, { ...input, package_sessions: "6", package_price: "300000",
      schedule_start_date: "2026-09-01", schedule_times: [{ day: 2, start_time: "16:00" }, { day: 7, start_time: "16:00" }] });
    expect(september.ok).toBe(true);
    const afterSeptember = await schedules();
    expect(afterSeptember).toHaveLength(10);
    expect(afterSeptember.filter((row) => row.start_at.startsWith("2026-10"))).toEqual(baseline);
    const invoices = await must(teacher.from("invoices").select("due_date").eq("student_id", studentId)
      .eq("user_id", userId!).order("due_date"));
    expect(invoices.map((row) => row.due_date)).toEqual(["2026-09-20", "2026-10-25"]);

    expect((await addPackageAction(studentId, input)).ok).toBe(true);
    expect(await schedules()).toEqual(afterSeptember);
    expect((await addPackageAction(studentId, { ...input, schedule_start_date: "2026-11-01" })).ok).toBe(true);
    const afterNovember = await schedules();
    expect(afterNovember).toHaveLength(14);
    expect(afterNovember.filter((row) => row.start_at.startsWith("2026-10"))).toEqual(baseline);
  });
});

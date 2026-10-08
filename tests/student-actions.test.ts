import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  getUser: vi.fn(), rpc: vi.fn(), from: vi.fn(),
  calls: [] as { table: string; method: string; args: unknown[] }[],
  results: {} as Record<string, { data: unknown; error: unknown }>,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: mock.getUser }, rpc: mock.rpc, from: mock.from,
}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addPackageAction, createStudentAction, updateStudentAction } from "@/lib/actions/students";
import { getPackageFormSetupAction, listPackageStudentsAction } from "@/lib/actions/package-setup";
import { DUPLICATE_STUDENT_MESSAGE } from "@/lib/utils/student-name";

const studentId = "11111111-1111-4111-8111-111111111111";
const validInput = {
  full_name: "Nama Murid", school_level: "SD", grade_level: "4", learning_mode: "offline",
  billing_type: "per_session", per_session_rate: "50000", subject_ids: ["subject"], status: "active",
};

beforeEach(() => {
  vi.clearAllMocks();
  mock.calls.length = 0;
  mock.results = {};
  mock.getUser.mockResolvedValue({ data: { user: { id: "teacher-id" } } });
  mock.rpc.mockResolvedValue({ data: true, error: null });
  mock.from.mockImplementation((table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is", "order", "limit", "range", "gte", "lte", "insert", "update", "delete"]) {
      query[method] = (...args: unknown[]) => {
        mock.calls.push({ table, method, args });
        return query;
      };
    }
    query.single = query.maybeSingle = () => Promise.resolve(mock.results[table] ?? { data: null, error: null });
    query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(mock.results[table] ?? { data: [], error: null }).then(resolve);
    return query;
  });
});

describe("tenggat paket dari jadwal terakhir", () => {
  beforeEach(() => {
    mock.results = {
      students: { data: { ...validInput, id: studentId }, error: null },
      profiles: { data: { timezone: "Asia/Jakarta" }, error: null },
      settings: { data: { default_duration_minutes: 60 }, error: null },
    };
    mock.rpc.mockImplementation(async (name: string) => ({
      data: name === "create_package" ? { invoice_id: "invoice-qa" } : false, error: null,
    }));
  });

  it.each(["murid baru", "paket baru"])("%s: enam pertemuan Senin/Rabu mulai 1 September berakhir 21 September", async (flow) => {
    const input = { ...validInput, billing_type: "package", package_sessions: "6",
      package_per_session_rate: "50000", package_price: "300000", package_start_date: "2026-10-09",
      schedule_start_date: "2026-09-01", schedule_times: [{ day: 1, start_time: "14:00" }, { day: 3, start_time: "14:00" }] };
    const result = flow === "murid baru" ? await createStudentAction(input) : await addPackageAction(studentId, input);
    expect(result.ok).toBe(true);
    expect(mock.rpc).toHaveBeenCalledWith("create_package", expect.objectContaining({
      p_total_sessions: 6, p_price: 300000, p_start_date: "2026-09-21",
    }));
    const insert = mock.calls.find((call) => call.table === "schedules" && call.method === "insert");
    expect(insert?.args[0]).toHaveLength(6);
    expect((insert?.args[0] as { start_at: string }[]).at(-1)?.start_at).toBe("2026-09-21T07:00:00.000Z");
  });

  it.each(["murid baru", "paket baru"])("%s: tanggal pilihan tetap dipakai ketika belum memilih hari mengajar", async (flow) => {
    const input = { ...validInput, billing_type: "package", package_sessions: "6",
      package_per_session_rate: "50000", package_price: "300000", package_start_date: "2026-10-09",
      schedule_start_date: "2026-09-01", schedule_times: [] };
    const result = flow === "murid baru" ? await createStudentAction(input) : await addPackageAction(studentId, input);
    expect(result.ok).toBe(true);
    expect(mock.rpc).toHaveBeenCalledWith("create_package", expect.objectContaining({ p_start_date: "2026-09-01" }));
    expect(mock.calls.some((call) => call.table === "schedules" && call.method === "insert")).toBe(false);
  });

  it.each(["murid baru", "paket baru"])("%s: tagihan bulanan dan jadwal mengikuti September yang dipilih", async (flow) => {
    mock.rpc.mockImplementation(async (name: string) => ({
      data: name === "create_invoice" ? { invoice_id: "invoice-qa" } : false, error: null,
    }));
    const input = { ...validInput, billing_type: "monthly", monthly_fee: "300000", monthly_due_day: "30",
      schedule_start_date: "2026-09-01", schedule_times: [{ day: 1, start_time: "14:00" }, { day: 3, start_time: "14:00" }] };
    const result = flow === "murid baru" ? await createStudentAction(input) : await addPackageAction(studentId, input);
    expect(result.ok).toBe(true);
    expect(mock.rpc).toHaveBeenCalledWith("create_invoice", expect.objectContaining({
      p_period_label: "September 2026", p_due_date: "2026-09-30",
    }));
    const insert = mock.calls.find((call) => call.table === "schedules" && call.method === "insert");
    expect(insert?.args[0]).toHaveLength(9);
    expect((insert?.args[0] as { start_at: string }[]).at(-1)?.start_at).toBe("2026-09-30T07:00:00.000Z");
  });

  it.each(["2026-09-01", "2026-10-01", "2026-11-01"])("paket mulai %s menambahkan jadwal tanpa menghapus paket lain", async (start) => {
    mock.results.schedules = { data: [{ start_at: "2026-10-11T09:00:00Z", location: null }], error: null };
    const result = await addPackageAction(studentId, { ...validInput, billing_type: "package",
      package_sessions: "4", package_per_session_rate: "50000", package_price: "200000",
      schedule_start_date: start, schedule_times: [{ day: 7, start_time: "16:00" }] });
    expect(result.ok).toBe(true);
    expect(mock.calls.filter((call) => call.table === "schedules" && call.method === "delete")).toEqual([]);
    const inserted = mock.calls.find((call) => call.table === "schedules" && call.method === "insert");
    expect(inserted?.args[0]).toHaveLength(start.startsWith("2026-10") ? 3 : 4);
    expect((inserted?.args[0] as { start_at: string }[]).every((row) => row.start_at !== "2026-10-11T09:00:00.000Z")).toBe(true);
  });

  it("mempertahankan jadwal selesai dan dibatalkan pada tanggal yang sama tanpa duplikasi", async () => {
    mock.results.schedules = { data: [
      { start_at: "2026-09-06T09:00:00+00:00", status: "completed" },
      { start_at: "2026-09-13T09:00:00Z", status: "cancelled" },
    ], error: null };
    const result = await addPackageAction(studentId, { ...validInput, billing_type: "package",
      package_sessions: "4", package_per_session_rate: "50000", package_price: "200000",
      schedule_start_date: "2026-09-01", schedule_times: [{ day: 7, start_time: "16:00" }] });
    expect(result.ok).toBe(true);
    const inserted = mock.calls.find((call) => call.table === "schedules" && call.method === "insert");
    expect((inserted?.args[0] as { start_at: string }[]).map((row) => row.start_at)).toEqual([
      "2026-09-20T09:00:00.000Z", "2026-09-27T09:00:00.000Z",
    ]);
    expect(mock.calls.filter((call) => call.table === "schedules" && ["delete", "update"].includes(call.method))).toEqual([]);
    expect(mock.calls).toContainEqual({ table: "schedules", method: "eq", args: ["user_id", "teacher-id"] });
    expect(mock.calls).toContainEqual({ table: "schedules", method: "eq", args: ["student_id", studentId] });
  });
});

describe("student duplicate validation", () => {
  it("rejects a duplicate before creating parent, invoice, or schedule records", async () => {
    const result = await createStudentAction({ ...validInput, parent_name: "New parent", parent_whatsapp: "08123456789" });
    expect(result).toEqual({ ok: false, error: DUPLICATE_STUDENT_MESSAGE });
    expect(mock.from).not.toHaveBeenCalled();
  });
  it("rejects duplicate renaming before any writes", async () => {
    mock.results.students = { data: { id: studentId }, error: null };
    expect((await updateStudentAction(studentId, validInput)).error).toBe(DUPLICATE_STUDENT_MESSAGE);
    expect(mock.rpc).toHaveBeenCalledWith("student_name_conflicts", { p_name: "Nama Murid", p_student_id: studentId });
    expect(mock.calls.filter((call) => ["insert", "update", "upsert", "delete"].includes(call.method))).toEqual([]);
  });
  it("fails safely if the name check cannot run", async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    expect((await createStudentAction(validInput)).ok).toBe(false);
    expect(mock.from).not.toHaveBeenCalled();
  });
  it("handles a competing insert rejected by the database guard", async () => {
    mock.rpc.mockResolvedValue({ data: false, error: null });
    mock.results.students = { data: null, error: { code: "23505", message: DUPLICATE_STUDENT_MESSAGE } };
    expect((await createStudentAction(validInput)).error).toBe(DUPLICATE_STUDENT_MESSAGE);
    expect(mock.from).toHaveBeenCalledTimes(1);
    expect(mock.from).toHaveBeenCalledWith("students");
  });
  it("requires authentication and rejects blank names", async () => {
    mock.getUser.mockResolvedValue({ data: { user: null } });
    expect((await createStudentAction(validInput)).ok).toBe(false);
    expect((await createStudentAction({ ...validInput, full_name: "   " })).ok).toBe(false);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
});

describe("student-first package flow", () => {
  it("only lists the signed-in teacher's nondeleted students", async () => {
    mock.results.students = { data: [{ id: studentId, full_name: "Nama Murid" }], error: null };
    expect((await listPackageStudentsAction()).data).toHaveLength(1);
    expect(mock.calls).toContainEqual({ table: "students", method: "eq", args: ["user_id", "teacher-id"] });
    expect(mock.calls).toContainEqual({ table: "students", method: "is", args: ["deleted_at", null] });
  });
  it("keeps the selected student's package, subjects, schedule and duration prefill", async () => {
    mock.results = {
      students: { data: { id: studentId, full_name: "Nama Murid", learning_mode: "online", status: "active" }, error: null },
      student_subjects: { data: [{ subject_id: "math" }], error: null },
      subjects: { data: [{ id: "math", name: "Matematika" }], error: null },
      student_packages: { data: { total_sessions: 8, per_session_rate: "50000" }, error: null },
      schedules: { data: [{ start_at: "2026-10-12T07:00:00Z", location: "Rumah" }], error: null },
      profiles: { data: { timezone: "Asia/Jakarta" }, error: null },
      settings: { data: { default_duration_minutes: 60 }, error: null },
    };
    const result = await getPackageFormSetupAction(studentId);
    expect(result.ok).toBe(true);
    expect(result.data?.initial).toMatchObject({ id: studentId, full_name: "Nama Murid", billing_type: "package",
      learning_mode: "online", package_sessions: 8, package_per_session_rate: "50000", subject_ids: ["math"],
      schedule_times: [{ day: 1, start_time: "14:00" }], schedule_start_date: "2026-10-12",
      package_start_date: "2026-10-12", schedule_location: "Rumah" });
    expect(result.data?.defaultDurationMinutes).toBe(60);
    expect(result.data?.timezone).toBe("Asia/Jakarta");
    expect(mock.calls).toContainEqual({ table: "students", method: "eq", args: ["user_id", "teacher-id"] });
    expect(mock.calls).toContainEqual({ table: "students", method: "eq", args: ["id", studentId] });
  });
  it("does not show a form for a missing/foreign student, malformed id or logged-out account", async () => {
    mock.results.students = { data: null, error: null };
    expect((await getPackageFormSetupAction(studentId)).ok).toBe(false);
    expect((await getPackageFormSetupAction("invalid-id")).ok).toBe(false);
    mock.getUser.mockResolvedValue({ data: { user: null } });
    expect((await getPackageFormSetupAction(studentId)).ok).toBe(false);
    expect((await listPackageStudentsAction()).ok).toBe(false);
  });
});

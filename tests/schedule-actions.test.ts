import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: mock.getUser }, rpc: mock.rpc, from: mock.from,
}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { revalidatePath } from "next/cache";
import { switchScheduleAction } from "@/lib/actions/schedule";
import { switchScheduleSchema } from "@/lib/validations/session";

const scheduleId = "11111111-1111-4111-8111-111111111111";
const input = { date: "2026-09-08", time: "14:30" };

beforeEach(() => {
  vi.clearAllMocks();
  mock.getUser.mockResolvedValue({ data: { user: { id: "teacher-id" } } });
  mock.rpc.mockResolvedValue({ data: null, error: null });
});

describe("move a scheduled or completed occurrence", () => {
  it("uses one atomic RPC and refreshes all views and reminders", async () => {
    expect((await switchScheduleAction(scheduleId, input)).ok).toBe(true);
    expect(mock.rpc).toHaveBeenNthCalledWith(1, "move_schedule", {
      p_schedule_id: scheduleId, p_date: "2026-09-08", p_time: "14:30",
    });
    expect(mock.rpc).toHaveBeenNthCalledWith(2, "refresh_reminders");
    expect(mock.from).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
  it("requires authentication before calling the database", async () => {
    mock.getUser.mockResolvedValue({ data: { user: null } });
    expect(await switchScheduleAction(scheduleId, input)).toEqual({ ok: false, error: "Tidak terautentikasi." });
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("rejects an invalid ID before doing any work", async () => {
    expect((await switchScheduleAction("invalid", input)).ok).toBe(false);
    expect(mock.getUser).not.toHaveBeenCalled();
  });
  it.each([
    { date: "2026-02-30", time: "14:30" },
    { date: "2026-13-01", time: "14:30" },
    { date: "0000-01-01", time: "14:30" },
    { date: "2026-09-08", time: "24:00" },
    { date: "2026-09-08", time: "12:60" },
    { date: "", time: "" },
  ])("rejects invalid dates and times: %j", async (invalidInput) => {
    expect((await switchScheduleAction(scheduleId, invalidInput)).ok).toBe(false);
    expect(mock.getUser).not.toHaveBeenCalled();
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("accepts a real leap day and both valid time boundaries", () => {
    expect(switchScheduleSchema.safeParse({ date: "2028-02-29", time: "00:00" }).success).toBe(true);
    expect(switchScheduleSchema.safeParse({ date: "2028-02-29", time: "23:59" }).success).toBe(true);
  });
  it("returns a database rejection without refreshing anything", async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { message: "Jadwal tidak ditemukan atau sudah dibatalkan." } });
    expect(await switchScheduleAction(scheduleId, input)).toEqual({ ok: false, error: "Jadwal tidak ditemukan atau sudah dibatalkan." });
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("handles a failed request without falsely reporting success", async () => {
    mock.rpc.mockRejectedValueOnce(new Error("Koneksi gagal."));
    expect(await switchScheduleAction(scheduleId, input)).toEqual({ ok: false, error: "Koneksi gagal." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("keeps a successful move when refreshing reminders fails", async () => {
    mock.rpc.mockResolvedValueOnce({ data: null, error: null }).mockRejectedValueOnce(new Error("Reminder unavailable"));
    expect((await switchScheduleAction(scheduleId, input)).ok).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});

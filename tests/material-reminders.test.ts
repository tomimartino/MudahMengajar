import { beforeEach, describe, expect, it, vi } from "vitest";
import { billingSettingsSchema } from "@/lib/validations/settings";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), getUser: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { getPreviousSessionAction, refreshRemindersAction } from "@/lib/actions/notifications";
const scheduleId = "c92796be-ecaa-40e5-b5cf-415ba318369b";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc });
  mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } } });
  mocks.rpc.mockResolvedValue({ data: null, error: null });
});
describe("materi sebelumnya", () => {
  it("menolak id jadwal tidak valid sebelum mengakses database", async () => {
    expect((await getPreviousSessionAction("invalid")).ok).toBe(false);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("menolak akses tanpa sesi", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect((await getPreviousSessionAction(scheduleId)).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("mengembalikan null untuk pertemuan pertama", async () => {
    expect(await getPreviousSessionAction(scheduleId)).toMatchObject({ ok: true, data: null });
  });
  it("mengembalikan materi dari RPC yang membatasi kepemilikan", async () => {
    const previous = { id: "previous-id", material: "Pecahan", homework: "Latihan 1" };
    mocks.rpc.mockResolvedValue({ data: previous, error: null });
    expect((await getPreviousSessionAction(scheduleId)).data).toEqual(previous);
    expect(mocks.rpc).toHaveBeenCalledWith("get_previous_session", { p_schedule_id: scheduleId });
  });
  it("melaporkan kegagalan refresh Supabase", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    expect((await refreshRemindersAction()).ok).toBe(false);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("memungkinkan pengingat jadwal dan materi diaktifkan secara terpisah", () => {
    const settings = { default_duration_minutes: 90, deduct_package_policy: "hadir_only", payment_reminder_days: 3,
      package_low_threshold: 2, notify_schedule: true, notify_payment: true, notify_package: true, notify_material: false };
    expect(billingSettingsSchema.safeParse(settings).success).toBe(true);
    expect(billingSettingsSchema.safeParse({ ...settings, notify_schedule: false, notify_material: true }).success).toBe(true);
    expect(billingSettingsSchema.safeParse({ ...settings, notify_schedule: "yes" }).success).toBe(false);
  });
});

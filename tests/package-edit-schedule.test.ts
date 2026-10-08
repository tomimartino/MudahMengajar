import { describe, expect, it } from "vitest";
import { editedPackageDueDate, type PackageScheduleContext } from "@/lib/utils/package-edit-schedule";

const base: PackageScheduleContext = { total: 4, used: 0, startDate: "2026-10-03",
  times: [{ day: 6, start_time: "10:00" }], dueDate: "2026-10-31",
  history: [{ start_at: "2026-10-03T03:00:00Z", status: "cancelled" }] };

describe("preview for edited packages with history", () => {
  it("keeps the actual due date when only the tariff changes", () => {
    expect(editedPackageDueDate(base, 4, base.startDate, base.times, "Asia/Jakarta")).toBe("2026-10-31");
  });
  it("counts preserved completed meetings and skips cancelled dates", () => {
    const context = { ...base, history: [...base.history, { start_at: "2026-10-10T03:00:00Z", status: "completed" }] };
    expect(editedPackageDueDate(context, 5, base.startDate, base.times, "Asia/Jakarta")).toBe("2026-11-07");
    expect(editedPackageDueDate(context, 5, base.startDate, [{ day: 3, start_time: "15:00" }], "Asia/Jakarta")).toBe("2026-11-04");
  });
});

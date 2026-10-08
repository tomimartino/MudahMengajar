import { describe, expect, it } from "vitest";
import { buildBillingSchedule } from "@/lib/utils/billing-schedule";

const clock = new Date("2026-10-08T18:00:00Z");
const input = {
  billing_type: "package" as const, package_sessions: "6", package_start_date: "2026-10-09",
  monthly_due_day: "30", schedule_start_date: "2026-09-01",
  schedule_times: [{ day: 1, start_time: "14:00" }, { day: 3, start_time: "14:00" }],
};
const build = (overrides: Partial<Parameters<typeof buildBillingSchedule>[0]> = {}, tz = "Asia/Jakarta") =>
  buildBillingSchedule({ ...input, ...overrides }, tz, clock);

describe("tanggal tagihan mengikuti jadwal yang dipilih", () => {
  it("memisahkan enam pertemuan September dan empat pertemuan Oktober", () => {
    const september = build();
    const october = build({ package_sessions: "4", schedule_start_date: "2026-10-01" });
    expect(september.dates).toHaveLength(6);
    expect(september.dueDate).toBe("2026-09-21");
    expect(october.dates).toHaveLength(4);
    expect(october.dueDate).toBe("2026-10-14");
  });
  it("mengikuti pertemuan terakhir jika paket melintasi bulan", () => {
    expect(build({ schedule_start_date: "2026-09-16" }).dueDate).toBe("2026-10-05");
  });
  it("memakai tanggal terlihat tanpa hari mengajar, bukan nilai lama yang tersembunyi", () => {
    expect(build({ schedule_times: [] })).toEqual({ dates: [], dueDate: "2026-09-01" });
  });
  it("mendukung tanggal paket dari klien lama saat tanggal jadwal kosong", () => {
    expect(build({ schedule_start_date: "", package_start_date: "2025-09-01" }).dueDate).toBe("2025-09-17");
  });
  it.each(["2025-09-01", "2026-09-01", "2027-09-01"])("bulanan %s berhenti di tenggat bulan terpilih", (start) => {
    const result = build({ billing_type: "monthly", schedule_start_date: start });
    expect(result.dueDate).toBe(`${start.slice(0, 7)}-30`);
    expect(result.dates.every((date) => date.date <= result.dueDate && date.date.startsWith(start.slice(0, 7)))).toBe(true);
  });
  it("tenggat berikutnya jika tanggal mulai sudah melewati hari jatuh tempo", () => {
    const result = build({ billing_type: "monthly", schedule_start_date: "2026-09-20", monthly_due_day: "10" });
    expect(result.dueDate).toBe("2026-10-10");
    expect(result.dates[0].date).toBe("2026-09-21");
    expect(result.dates.at(-1)?.date).toBe("2026-10-07");
  });
  it.each([["2027-02-01", "2027-02-28"], ["2028-02-01", "2028-02-29"], ["2026-12-31", "2027-01-10"]])("menangani panjang bulan dan pergantian tahun mulai %s", (start, due) => {
    expect(build({ billing_type: "monthly", schedule_start_date: start,
      monthly_due_day: start.endsWith("12-31") ? "10" : "31" }).dueDate).toBe(due);
  });
  it("tetap menyertakan pertemuan pada tanggal tenggat yang dipilih", () => {
    expect(build({ billing_type: "monthly", schedule_start_date: "2026-09-30" })).toEqual({
      dates: [{ date: "2026-09-30", time: "14:00" }], dueDate: "2026-09-30",
    });
  });
  it("default tanpa tanggal atau jadwal mengikuti hari di zona waktu guru", () => {
    const blank = { schedule_start_date: "", package_start_date: "", schedule_times: [] };
    expect(build(blank, "Asia/Jakarta").dueDate).toBe("2026-10-09");
    expect(build(blank, "America/Los_Angeles").dueDate).toBe("2026-10-08");
  });
  it("isian belum lengkap tidak membuat jadwal tanpa batas atau tanggal tidak valid", () => {
    expect(build({ package_sessions: "" }).dueDate).toBe("");
    expect(build({ schedule_start_date: "2026-02-30" }).dueDate).toBe("");
    expect(build({ billing_type: "monthly", monthly_due_day: "" }).dueDate).toBe("");
  });
});

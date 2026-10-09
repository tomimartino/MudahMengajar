import { describe, expect, it } from "vitest";
import { resolveReportFilters } from "@/lib/reports/filters";

describe("report periods", () => {
  it("uses the teacher's calendar month across the UTC boundary", () => {
    const now = new Date("2026-09-30T18:00:00Z");
    expect(resolveReportFilters({}, "Asia/Jakarta", now)).toEqual({ from: "2026-10-01", to: "2026-10-31", student: "" });
    expect(resolveReportFilters({}, "America/New_York", now)).toEqual({ from: "2026-09-01", to: "2026-09-30", student: "" });
  });
  it("keeps explicit dates and rejects impossible or empty dates", () => {
    const now = new Date("2028-02-15T00:00:00Z");
    expect(resolveReportFilters({ from: "2028-02-01", to: "2028-02-29", student: "s" }, "Asia/Jakarta", now))
      .toEqual({ from: "2028-02-01", to: "2028-02-29", student: "s" });
    expect(resolveReportFilters({ from: "", to: "2028-02-30" }, "Asia/Jakarta", now))
      .toEqual({ from: "2028-02-01", to: "2028-02-29", student: "" });
  });
});

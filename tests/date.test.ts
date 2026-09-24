import { describe, expect, it } from "vitest";
import {
  buildMonthOptions,
  formatDate,
  formatTime,
  formatDayDate,
  formatMonthYear,
  toDateInput,
} from "@/lib/utils/date";

const SAMPLE = "2026-09-20T09:30:00.000Z"; // 16.30 WIB

describe("format tanggal Indonesia", () => {
  it("formatDate → 20 September 2026", () => {
    expect(formatDate(SAMPLE)).toBe("20 September 2026");
  });

  it("formatTime → 16.30 (WIB dari UTC 09.30)", () => {
    expect(formatTime(SAMPLE)).toBe("16.30");
  });

  it("formatDayDate → Minggu, 20 September 2026", () => {
    expect(formatDayDate(SAMPLE)).toBe("Minggu, 20 September 2026");
  });

  it("formatMonthYear → September 2026", () => {
    expect(formatMonthYear(SAMPLE)).toBe("September 2026");
  });

  it("toDateInput → yyyy-MM-dd", () => {
    expect(toDateInput(SAMPLE)).toBe("2026-09-20");
  });
});

describe("buildMonthOptions", () => {
  it("menampilkan bulan setelah bulan terpilih sampai bulan terkini", () => {
    const opts = buildMonthOptions("2026-04", "2026-09");
    const values = opts.map((o) => o.value);
    expect(values[0]).toBe("2026-09");
    expect(values).toContain("2026-05");
    expect(values).toContain("2026-04");
    expect(values).toContain("2025-05"); // batas −11 bulan
    expect(values).not.toContain("2026-10"); // masa depan tidak muncul
    expect(values).not.toContain("2025-04");
    expect(opts[0].label).toBe("September 2026");
  });

  it("bulan terpilih = bulan terkini menghasilkan 12 opsi", () => {
    const opts = buildMonthOptions("2026-09", "2026-09");
    expect(opts).toHaveLength(12);
    expect(opts[0].value).toBe("2026-09");
    expect(opts[11].value).toBe("2025-10");
  });

  it("bulan mendatang menjadi batas atas opsi", () => {
    const opts = buildMonthOptions("2027-01", "2026-09");
    expect(opts).toHaveLength(12);
    expect(opts[0].value).toBe("2027-01");
    expect(opts[11].value).toBe("2026-02");
  });
});

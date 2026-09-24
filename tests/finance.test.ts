import { describe, expect, it } from "vitest";
import {
  aggregateMonthly,
  lastTwelveMonthKeys,
  monthDateRange,
  monthLabel,
} from "@/lib/finance/queries";

describe("aggregateMonthly", () => {
  it("mengelompokkan pembayaran per bulan dan menjumlahkan total", () => {
    const payments = [
      { payment_date: "2026-09-01", amount: "100000", student_id: "a" },
      { payment_date: "2026-09-20", amount: "50000", student_id: "a" },
      { payment_date: "2026-10-05", amount: "75000", student_id: "b" },
    ];
    const map = aggregateMonthly(payments);

    expect(map.get("2026-09")?.total).toBe(150000);
    expect(map.get("2026-09")?.count).toBe(2);
    expect(map.get("2026-10")?.total).toBe(75000);
    expect(map.get("2026-10")?.count).toBe(1);
  });

  it("menghitung siswa unik (distinct student_id) per bulan", () => {
    const payments = [
      { payment_date: "2026-09-02", amount: "100000", student_id: "a" },
      { payment_date: "2026-09-03", amount: "50000", student_id: "a" },
      { payment_date: "2026-09-04", amount: "25000", student_id: "b" },
    ];
    const map = aggregateMonthly(payments);

    expect(map.get("2026-09")?.students.size).toBe(2);
  });

  it("mengembalikan map kosong tanpa pembayaran", () => {
    expect(aggregateMonthly([]).size).toBe(0);
  });

  it("menangani amount bertipe number maupun string", () => {
    const map = aggregateMonthly([
      { payment_date: "2026-09-01", amount: 100000, student_id: "a" },
      { payment_date: "2026-09-02", amount: "50000", student_id: "a" },
    ]);
    expect(map.get("2026-09")?.total).toBe(150000);
  });
});

describe("monthLabel", () => {
  it("memformat kunci bulan menjadi label Indonesia", () => {
    expect(monthLabel("2026-09")).toBe("September 2026");
    expect(monthLabel("2027-01")).toBe("Januari 2027");
  });
});

describe("lastTwelveMonthKeys", () => {
  it("menghasilkan 12 bulan mundur dari bulan terpilih", () => {
    expect(lastTwelveMonthKeys("2026-09")).toEqual([
      "2026-09",
      "2026-08",
      "2026-07",
      "2026-06",
      "2026-05",
      "2026-04",
      "2026-03",
      "2026-02",
      "2026-01",
      "2025-12",
      "2025-11",
      "2025-10",
    ]);
  });
});

describe("monthDateRange", () => {
  it("menghitung rentang tanggal dengan benar, termasuk tahun kabisat", () => {
    expect(monthDateRange("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(monthDateRange("2024-02")).toEqual({ start: "2024-02-01", end: "2024-02-29" });
    expect(monthDateRange("2026-12")).toEqual({ start: "2026-12-01", end: "2026-12-31" });
  });
});

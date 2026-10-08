import { describe, expect, it } from "vitest";
import {
  aggregateInvoiceMonthly,
  aggregateMonthly,
  invoiceMonthKey,
  paymentMonthKey,
  MONTH_KEY_RE,
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

describe("tanggal pembayaran dan jatuh tempo terpisah", () => {
  const septemberInvoice = { due_date: "2026-09-21", created_at: "2026-10-09T08:00:00Z" };
  const octoberInvoice = { due_date: "2026-10-21", created_at: "2026-09-25T08:00:00Z" };

  it("tagihan September yang dilunasi Oktober menghasilkan pendapatan Oktober", () => {
    const payment = { payment_date: "2026-10-09", amount: "300000", student_id: "a", invoice: septemberInvoice };
    const months = aggregateMonthly([payment]);
    expect(paymentMonthKey(payment)).toBe("2026-10");
    expect(months.get("2026-10")?.total).toBe(300000);
    expect(months.has("2026-09")).toBe(false);
    expect(payment.payment_date).toBe("2026-10-09");
  });

  it("mencatat cicilan pada tanggal masing-masing dan tidak menggandakannya", () => {
    const payments = [
      { payment_date: "2026-09-10", amount: 100000, student_id: "a", invoice: septemberInvoice },
      { payment_date: "2026-10-09", amount: 75000, student_id: "a", invoice: septemberInvoice },
      { payment_date: "2026-11-01", amount: 125000, student_id: "a", invoice: septemberInvoice },
      { payment_date: "2026-09-29", amount: 200000, student_id: "b", invoice: octoberInvoice },
    ];
    const months = aggregateMonthly(payments);
    expect(months.get("2026-09")).toMatchObject({ total: 300000, count: 2 });
    expect(months.get("2026-09")?.students.size).toBe(2);
    expect(months.get("2026-10")?.total).toBe(75000);
    expect(months.get("2026-11")?.total).toBe(125000);
  });

  it("estimasi memuat nominal tagihan lunas, sebagian, dan belum lunas pada bulan yang sama", () => {
    const invoices = [
      { ...septemberInvoice, amount: 300000, status: "paid" },
      { ...septemberInvoice, amount: 200000, status: "partial" },
      { ...septemberInvoice, amount: 100000, status: "unpaid" },
      { ...octoberInvoice, amount: 400000, status: "unpaid" },
    ];
    const estimates = aggregateInvoiceMonthly(invoices);
    const payments = [
      { payment_date: "2026-10-09", amount: 300000, student_id: "a", invoice: invoices[0] },
      { payment_date: "2026-10-09", amount: 50000, student_id: "b", invoice: invoices[1] },
    ];
    const paid = aggregateMonthly(payments);
    expect(estimates.get("2026-09")).toBe(600000);
    expect(estimates.get("2026-10")).toBe(400000);
    expect(paid.get("2026-10")?.total).toBe(350000);
    expect(paid.has("2026-09")).toBe(false);
  });

  it("menempatkan pelunasan tagihan Desember pada tanggal pembayaran Januari", () => {
    const payments = [{ payment_date: "2027-01-05", amount: 100000, student_id: "a",
      invoice: { due_date: "2026-12-31", created_at: "2027-01-01T08:00:00Z" } }];
    const months = aggregateMonthly(payments);
    expect(months.get("2027-01")?.total).toBe(100000);
    expect(months.has("2026-12")).toBe(false);
  });

  it("tanggal pembayaran tetap dipakai meskipun tagihan tidak memiliki jatuh tempo", () => {
    const payment = { payment_date: "2026-11-01", amount: 100000, student_id: "a",
      invoice: { due_date: null, created_at: "2026-09-30T18:00:00Z" } };
    expect(aggregateMonthly([payment]).get("2026-11")?.total).toBe(100000);
    expect(aggregateMonthly([payment]).has("2026-10")).toBe(false);
  });

  it("transaksi tanpa tagihan tetap memakai tanggal pembayaran", () => {
    expect(paymentMonthKey({ payment_date: "2026-10-09" })).toBe("2026-10");
  });

  it("menolak parameter bulan di luar 01–12", () => {
    expect(MONTH_KEY_RE.test("2026-09")).toBe(true);
    expect(MONTH_KEY_RE.test("2026-00")).toBe(false);
    expect(MONTH_KEY_RE.test("2026-13")).toBe(false);
  });
});

describe("aggregateInvoiceMonthly", () => {
  it("menjumlahkan nominal tagihan per bulan jatuh tempo, bukan bulan dibuat", () => {
    const invoices = [
      { created_at: "2026-10-01T08:00:00Z", due_date: "2026-09-10", amount: "200000" },
      { created_at: "2026-10-02T08:00:00Z", due_date: "2026-09-20", amount: "150000" },
      { created_at: "2026-10-02T08:00:00Z", due_date: "2026-10-20", amount: "300000" },
    ];
    const map = aggregateInvoiceMonthly(invoices);

    expect(map.get("2026-09")).toBe(350000);
    expect(map.get("2026-10")).toBe(300000);
  });

  it("menangani amount bertipe number maupun string", () => {
    const map = aggregateInvoiceMonthly([
      { created_at: "2026-09-01T08:00:00Z", due_date: "2026-09-20", amount: 100000 },
      { created_at: "2026-09-02T08:00:00Z", due_date: "2026-09-20", amount: "50000" },
    ]);
    expect(map.get("2026-09")).toBe(150000);
  });

  it("mengembalikan map kosong tanpa tagihan", () => {
    expect(aggregateInvoiceMonthly([]).size).toBe(0);
  });

  it("paket bulan lalu yang baru dimasukkan tidak menambah estimasi bulan sekarang", () => {
    const current = { created_at: "2026-10-01T08:00:00Z", due_date: "2026-10-20", amount: "1200000" };
    const before = aggregateInvoiceMonthly([current]);
    const after = aggregateInvoiceMonthly([current,
      { created_at: "2026-10-08T08:00:00Z", due_date: "2026-09-16", amount: "500000" },
    ]);
    expect(after.get("2026-10")).toBe(before.get("2026-10"));
    expect(after.get("2026-09")).toBe(500000);
  });

  it("mengikuti jatuh tempo saat paket berasal dari tahun lalu atau tahun berikutnya", () => {
    const map = aggregateInvoiceMonthly([
      { created_at: "2026-10-08T08:00:00Z", due_date: "2025-12-31", amount: "500000" },
      { created_at: "2026-12-31T08:00:00Z", due_date: "2027-01-15", amount: "750000" },
    ]);
    expect(map.get("2025-12")).toBe(500000);
    expect(map.get("2027-01")).toBe(750000);
    expect(map.has("2026-10")).toBe(false);
  });

  it("tagihan tanpa jatuh tempo mengikuti bulan dibuat dalam zona waktu guru", () => {
    const invoice = { created_at: "2026-09-30T18:00:00Z", due_date: null, amount: 100000 };
    expect(aggregateInvoiceMonthly([invoice], "Asia/Jakarta").get("2026-10")).toBe(100000);
    expect(aggregateInvoiceMonthly([invoice], "UTC").get("2026-09")).toBe(100000);
  });

  it("tanggal jatuh tempo tetap tanggal kalender meskipun zona waktu berubah", () => {
    expect(invoiceMonthKey({ created_at: "2026-10-08T08:00:00Z", due_date: "2026-10-01" }, "America/Los_Angeles")).toBe("2026-10");
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

import { describe, expect, it } from "vitest";
import { formatRupiah, parseAmount } from "@/lib/utils/currency";

describe("formatRupiah", () => {
  it("memformat angka bulat gaya Indonesia", () => {
    expect(formatRupiah(500000)).toBe("Rp500.000");
    expect(formatRupiah(1200000)).toBe("Rp1.200.000");
    expect(formatRupiah(0)).toBe("Rp0");
  });

  it("menerima string numerik dari Postgres", () => {
    expect(formatRupiah("500000")).toBe("Rp500.000");
  });

  it("menangani null/undefined", () => {
    expect(formatRupiah(null)).toBe("Rp0");
    expect(formatRupiah(undefined)).toBe("Rp0");
  });

  it("mendukung tanpa simbol", () => {
    expect(formatRupiah(500000, { withSymbol: false })).toBe("500.000");
  });
});

describe("parseAmount", () => {
  it("mem-parsing input pengguna dengan titik pemisah", () => {
    expect(parseAmount("500.000")).toBe(500000);
    expect(parseAmount("1.200.000")).toBe(1200000);
  });

  it("mem-parsing input kosong menjadi 0", () => {
    expect(parseAmount("")).toBe(0);
  });
});

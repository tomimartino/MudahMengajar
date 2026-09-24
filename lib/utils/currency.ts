/** Format Rupiah gaya Indonesia: "Rp500.000", "Rp1.200.000". */
export function formatRupiah(
  value: number | string | null | undefined,
  options: { withSymbol?: boolean } = {}
): string {
  const n =
    typeof value === "string" ? Number(value) : Math.round(Number(value ?? 0));
  if (!Number.isFinite(n)) return options.withSymbol === false ? "0" : "Rp0";
  const formatted = Math.round(n).toLocaleString("id-ID");
  return options.withSymbol === false ? formatted : `Rp${formatted}`;
}

/** Konversi string input pengguna ("500.000" atau "Rp500.000") ke angka. */
export function parseAmount(input: string): number {
  const cleaned = input.replace(/[^\d]/g, "");
  return cleaned ? Number(cleaned) : 0;
}

export function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

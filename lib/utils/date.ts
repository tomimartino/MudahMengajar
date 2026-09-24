import {
  addDays,
  endOfDay,
  endOfMonth,
  format,
  getISODay,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { id } from "date-fns/locale";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const DEFAULT_TZ = "Asia/Jakarta";

/** Konversi Date/string ke waktu lokal (zona waktu guru). */
export function zoned(date: Date | string, tz: string = DEFAULT_TZ): Date {
  const d = typeof date === "string" ? parseISO(date) : date;
  return toZonedTime(d, tz);
}

/** "20 September 2026" */
export function formatDate(date: Date | string, tz: string = DEFAULT_TZ): string {
  return format(zoned(date, tz), "d MMMM yyyy", { locale: id });
}

/** "20 Sep 2026" */
export function formatShortDate(date: Date | string, tz: string = DEFAULT_TZ): string {
  return format(zoned(date, tz), "d MMM yyyy", { locale: id });
}

/** "16.30" */
export function formatTime(date: Date | string, tz: string = DEFAULT_TZ): string {
  return format(zoned(date, tz), "HH.mm");
}

/** "20 September 2026, 16.30" */
export function formatDateTime(date: Date | string, tz: string = DEFAULT_TZ): string {
  return format(zoned(date, tz), "d MMMM yyyy, HH.mm", { locale: id });
}

/** "Senin" */
export function formatDayName(date: Date | string, tz: string = DEFAULT_TZ): string {
  return format(zoned(date, tz), "EEEE", { locale: id });
}

/** "Senin, 20 September 2026" */
export function formatDayDate(date: Date | string, tz: string = DEFAULT_TZ): string {
  return format(zoned(date, tz), "EEEE, d MMMM yyyy", { locale: id });
}

/** "September 2026" */
export function formatMonthYear(date: Date | string, tz: string = DEFAULT_TZ): string {
  return format(zoned(date, tz), "MMMM yyyy", { locale: id });
}

/** "yyyy-MM-dd" untuk input type=date. */
export function toDateInput(date: Date | string, tz: string = DEFAULT_TZ): string {
  return format(zoned(date, tz), "yyyy-MM-dd");
}

export function todayInTz(tz: string = DEFAULT_TZ): Date {
  return toZonedTime(new Date(), tz);
}

export function startOfToday(tz: string = DEFAULT_TZ): Date {
  return fromZonedTime(startOfDay(todayInTz(tz)), tz);
}

export function endOfToday(tz: string = DEFAULT_TZ): Date {
  return fromZonedTime(endOfDay(todayInTz(tz)), tz);
}

export function startOfMonthTz(date: Date | string, tz: string = DEFAULT_TZ): Date {
  return fromZonedTime(startOfMonth(zoned(date, tz)), tz);
}

export function endOfMonthTz(date: Date | string, tz: string = DEFAULT_TZ): Date {
  return fromZonedTime(endOfMonth(zoned(date, tz)), tz);
}

export function isSameLocalDay(
  a: Date | string,
  b: Date | string,
  tz: string = DEFAULT_TZ
): boolean {
  return isSameDay(zoned(a, tz), zoned(b, tz));
}

export function addDaysLocal(
  date: Date | string,
  amount: number,
  tz: string = DEFAULT_TZ
): Date {
  return fromZonedTime(addDays(zoned(date, tz), amount), tz);
}

/** Hari dalam seminggu ISO (1 = Senin ... 7 = Minggu) dari tanggal lokal. */
export function localISODay(date: Date | string, tz: string = DEFAULT_TZ): number {
  return getISODay(zoned(date, tz));
}

/**
 * Opsi dropdown bulan: dari bulan terpilih − 11 bulan sampai bulan terkini
 * (atau bulan terpilih jika berada di masa depan), urut terbaru di atas.
 */
export function buildMonthOptions(
  selectedMonth: string,
  latestMonth?: string
): { value: string; label: string }[] {
  const [selYear, selMonthNum] = selectedMonth.split("-").map(Number);
  const sel = new Date(selYear, selMonthNum - 1, 1);
  const latest =
    latestMonth ?? toDateInput(todayInTz("Asia/Jakarta"), "Asia/Jakarta").slice(0, 7);
  const [latestYear, latestMonthNum] = latest.split("-").map(Number);
  const latestDate = new Date(latestYear, latestMonthNum - 1, 1);
  const end = sel > latestDate ? sel : latestDate;
  const start = new Date(selYear, selMonthNum - 1 - 11, 1);
  const options: { value: string; label: string }[] = [];
  for (let d = new Date(end); d >= start; d.setMonth(d.getMonth() - 1)) {
    options.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
    });
  }
  return options;
}

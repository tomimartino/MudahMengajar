import { format } from "date-fns";
import { id } from "date-fns/locale";

export interface MonthlyPayment {
  payment_date: string;
  amount: number | string;
  student_id: string;
}

export interface MonthAggregate {
  total: number;
  count: number;
  students: Set<string>;
}

/** Pola "YYYY-MM" untuk parameter bulan di URL. */
export const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

/** Agregat pembayaran per bulan, dikunci "YYYY-MM" (kolom payment_date adalah date murni). */
export function aggregateMonthly(payments: MonthlyPayment[]): Map<string, MonthAggregate> {
  const map = new Map<string, MonthAggregate>();
  for (const p of payments) {
    const key = p.payment_date.slice(0, 7);
    const cur = map.get(key) ?? { total: 0, count: 0, students: new Set<string>() };
    cur.total += Number(p.amount);
    cur.count += 1;
    cur.students.add(p.student_id);
    map.set(key, cur);
  }
  return map;
}

/** "2026-09" → "September 2026" (lokal Indonesia). */
export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return format(new Date(year, month - 1, 1), "MMMM yyyy", { locale: id });
}

/** 12 kunci bulan "YYYY-MM" dari bulan terpilih mundur 11 bulan (terbaru di depan). */
export function lastTwelveMonthKeys(selectedMonth: string): string[] {
  const [year, month] = selectedMonth.split("-").map(Number);
  const keys: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(year, month - 1 - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

/** Rentang tanggal "YYYY-MM-DD" untuk satu bulan (awal s.d. akhir bulan). */
export function monthDateRange(monthKey: string): { start: string; end: string } {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${monthKey}-01`,
    end: `${monthKey}-${String(lastDay).padStart(2, "0")}`,
  };
}

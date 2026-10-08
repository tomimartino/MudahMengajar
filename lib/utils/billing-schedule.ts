import { addDays, format, getISODay, isValid, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { StudentInput } from "@/lib/validations/student";

type BillingScheduleInput = Pick<StudentInput,
  "billing_type" | "package_sessions" | "package_start_date" | "monthly_due_day" |
  "schedule_start_date" | "schedule_times"
>;

/** Satu perhitungan untuk pratinjau form, jadwal yang disimpan, dan tenggat tagihan. */
export function buildBillingSchedule(
  input: BillingScheduleInput,
  timezone: string = "Asia/Jakarta",
  now: Date = new Date()
): { dates: { date: string; time: string }[]; dueDate: string } {
  const dates: { date: string; time: string }[] = [];
  const localNow = toZonedTime(now, timezone);
  const selectedDate = input.schedule_start_date ||
    (input.billing_type === "package" ? input.package_start_date : "");
  const startKey = selectedDate || format(localNow, "yyyy-MM-dd");
  let cursor = parseISO(startKey);
  if (!isValid(cursor) || format(cursor, "yyyy-MM-dd") !== startKey) return { dates, dueDate: "" };

  const timeByDay = new Map(input.schedule_times
    .filter((entry) => entry.day >= 1 && entry.day <= 7 && /^\d{2}:\d{2}$/.test(entry.start_time))
    .map((entry) => [entry.day, entry.start_time]));
  // Tanpa tanggal pilihan, hari ini hanya disertakan jika jam mengajar belum lewat.
  if (!selectedDate && timeByDay.size > 0) {
    const todayTime = timeByDay.get(getISODay(localNow));
    if (!todayTime || format(localNow, "HH:mm") >= todayTime) cursor = addDays(cursor, 1);
  }

  if (input.billing_type === "package") {
    const count = Number(input.package_sessions);
    if (!Number.isInteger(count) || count < 1 || count > 200) return { dates, dueDate: "" };
    if (timeByDay.size > 0) {
      while (dates.length < count) {
        const time = timeByDay.get(getISODay(cursor));
        if (time) dates.push({ date: format(cursor, "yyyy-MM-dd"), time });
        cursor = addDays(cursor, 1);
      }
    }
    // Jadwal opsional: tanggal terlihat tetap menjadi acuan ketika hari belum dipilih.
    return { dates, dueDate: dates.at(-1)?.date ?? startKey };
  }

  if (input.billing_type === "monthly") {
    const day = Number(input.monthly_due_day);
    if (!Number.isInteger(day) || day < 1 || day > 31) return { dates, dueDate: "" };
    const dueInMonth = (month: number) => new Date(cursor.getFullYear(), month,
      Math.min(day, new Date(cursor.getFullYear(), month + 1, 0).getDate()));
    let due = dueInMonth(cursor.getMonth());
    if (due < cursor) due = dueInMonth(cursor.getMonth() + 1);
    const dueDate = format(due, "yyyy-MM-dd");
    if (timeByDay.size > 0) {
      while (format(cursor, "yyyy-MM-dd") <= dueDate) {
        const time = timeByDay.get(getISODay(cursor));
        if (time) dates.push({ date: format(cursor, "yyyy-MM-dd"), time });
        cursor = addDays(cursor, 1);
      }
    }
    return { dates, dueDate };
  }
  return { dates, dueDate: "" };
}

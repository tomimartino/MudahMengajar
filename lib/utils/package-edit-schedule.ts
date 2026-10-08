import { addDays, format, getISODay, isValid, parseISO } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export interface PackageScheduleContext {
  total: number;
  used: number;
  startDate: string;
  times: { day: number; start_time: string }[];
  dueDate: string;
  history: { start_at: string; status: string }[];
}

/** Preview uses preserved completed/cancelled meetings as well as the edited pattern. */
export function editedPackageDueDate(
  context: PackageScheduleContext, total: number, startDate: string,
  times: PackageScheduleContext["times"], timezone: string,
): string {
  if (total === context.total && startDate === context.startDate && JSON.stringify(times) === JSON.stringify(context.times)) return context.dueDate;
  let cursor = parseISO(startDate);
  if (!isValid(cursor) || total < 1 || total > 200) return "";
  const completed = context.history.filter((row) => row.status === "completed");
  const completedStarts = completed.map((row) => new Date(row.start_at).getTime());
  const latest = Math.max(0, ...completedStarts);
  const excludedDates = new Set(context.history.map((row) => format(toZonedTime(row.start_at, timezone), "yyyy-MM-dd")));
  const remaining = Math.max(0, total - Math.max(context.used, completed.length));
  const byDay = new Map(times.filter((entry) => /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.start_time)).map((entry) => [entry.day, entry.start_time]));
  let dueDate = completed.length ? format(toZonedTime(new Date(latest), timezone), "yyyy-MM-dd") : startDate;
  if (!byDay.size) return dueDate;
  let generated = 0;
  for (let n = 0; generated < remaining && n <= 2000; n++, cursor = addDays(cursor, 1)) {
    const day = format(cursor, "yyyy-MM-dd");
    const time = byDay.get(getISODay(cursor));
    if (!time || excludedDates.has(day)) continue;
    if (fromZonedTime(`${day}T${time}:00`, timezone).getTime() <= latest) continue;
    generated++; dueDate = day;
  }
  return generated === remaining ? dueDate : "";
}

import { format, isValid, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { monthDateRange } from "@/lib/finance/queries";
import type { ReportFilters } from "./queries";

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseISO(value);
  return isValid(parsed) && format(parsed, "yyyy-MM-dd") === value;
}

/** UI and CSV share the same period, calculated in the teacher's timezone. */
export function resolveReportFilters(
  values: Record<string, unknown>, timezone = "Asia/Jakarta", now = new Date(),
): ReportFilters {
  const month = format(toZonedTime(now, timezone), "yyyy-MM");
  const range = monthDateRange(month);
  return {
    from: validDate(values.from) ? values.from : range.start,
    to: validDate(values.to) ? values.to : range.end,
    student: typeof values.student === "string" ? values.student : "",
  };
}

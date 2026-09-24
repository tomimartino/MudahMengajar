import { DEFAULT_TZ, formatDate, formatDateTime, formatDayDate, formatShortDate, formatTime } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

type Variant = "date" | "shortDate" | "time" | "dateTime" | "dayDate";

export function DateText({
  value,
  tz = DEFAULT_TZ,
  variant = "date",
  className,
}: {
  value: Date | string;
  tz?: string;
  variant?: Variant;
  className?: string;
}) {
  const text =
    variant === "shortDate"
      ? formatShortDate(value, tz)
      : variant === "time"
        ? formatTime(value, tz)
        : variant === "dateTime"
          ? formatDateTime(value, tz)
          : variant === "dayDate"
            ? formatDayDate(value, tz)
            : formatDate(value, tz);
  return <span className={cn("tabular-nums", className)}>{text}</span>;
}

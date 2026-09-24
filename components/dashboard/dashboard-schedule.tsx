"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { id } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { CompleteSessionDialog } from "@/components/dashboard/complete-session-dialog";
import { ScheduleDetailDialog, type ScheduleItem } from "@/components/schedule/schedule-detail-dialog";
import { ScheduleStatusBadge } from "@/components/shared/badges";
import { DateText } from "@/components/shared/date-text";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { LEARNING_MODES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface DashboardScheduleItem extends ScheduleItem {
  grade_level: string | null;
  school_level: string | null;
}

export type CalendarView = "day" | "week" | "month";

export function DashboardSchedule({
  schedules,
  date,
  view,
  timezone,
  defaultDuration,
  basePath = "/dashboard",
}: {
  schedules: DashboardScheduleItem[];
  date: string;
  view: CalendarView;
  timezone: string;
  defaultDuration: number;
  basePath?: string;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>(
    format(toZonedTime(new Date(), timezone), "yyyy-MM-dd")
  );
  const [completing, setCompleting] = useState<DashboardScheduleItem | null>(null);
  const [detail, setDetail] = useState<DashboardScheduleItem | null>(null);

  const current = parse(date, "yyyy-MM-dd", new Date());

  const days = useMemo(() => {
    if (view === "day") return [current];
    const start =
      view === "week"
        ? startOfWeek(current, { weekStartsOn: 1 })
        : startOfWeek(startOfMonth(current), { weekStartsOn: 1 });
    const end =
      view === "week"
        ? endOfWeek(current, { weekStartsOn: 1 })
        : endOfWeek(endOfMonth(current), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [current, view]);

  function navigate(direction: -1 | 1) {
    const next =
      view === "day"
        ? addDays(current, direction)
        : view === "week"
          ? addWeeks(current, direction)
          : addMonths(current, direction);
    setParam("date", format(next, "yyyy-MM-dd"));
  }

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    params.set(key, value);
    router.push(`${basePath}?${params.toString()}`);
  }

  const schedulesByDay = useMemo(() => {
    const map = new Map<string, DashboardScheduleItem[]>();
    for (const s of schedules) {
      const key = format(toZonedTime(s.start_at, timezone), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.start_at.localeCompare(b.start_at));
    }
    return map;
  }, [schedules, timezone]);

  const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

  const header =
    view === "day"
      ? format(current, "EEEE, d MMMM yyyy", { locale: id })
      : view === "week"
        ? `${format(days[0]!, "d MMM", { locale: id })} – ${format(days[days.length - 1]!, "d MMM yyyy", { locale: id })}`
        : format(current, "MMMM yyyy", { locale: id });

  const selectedSchedules = schedulesByDay.get(selectedDate) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} aria-label="Mundur">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate(1)} aria-label="Maju">
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setParam("date", format(new Date(), "yyyy-MM-dd"));
              setSelectedDate(format(toZonedTime(new Date(), timezone), "yyyy-MM-dd"));
            }}
          >
            Hari Ini
          </Button>
        </div>
        <p className="text-base font-semibold capitalize">{header}</p>
        <div className="flex rounded-lg border p-0.5">
          {(["day", "week", "month"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setParam("view", v)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors",
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v === "day" ? "Hari" : v === "week" ? "Minggu" : "Bulan"}
            </button>
          ))}
        </div>
      </div>

      {view === "month" && (
        <div className="grid grid-cols-7 border-b text-center text-xs font-medium text-muted-foreground">
          {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
      )}

      {view === "month" ? (
        <div className="grid grid-cols-7 border-l border-t">
          {days.map((d) => {
            const count = schedulesByDay.get(dayKey(d))?.length ?? 0;
            const isSelected = dayKey(d) === selectedDate;
            return (
              <button
                key={dayKey(d)}
                onClick={() => setSelectedDate(dayKey(d))}
                className={cn(
                  "min-h-20 border-b border-r p-1.5 text-left transition-colors hover:bg-muted/50",
                  !isSameMonth(d, current) && "bg-muted/30",
                  isSelected && "bg-primary/10 ring-2 ring-inset ring-primary",
                  isToday(d) && !isSelected && "bg-primary/5"
                )}
              >
                <span
                  className={cn(
                    "mb-1 flex size-6 items-center justify-center rounded-full text-xs font-medium",
                    isToday(d) ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  )}
                >
                  {format(d, "d")}
                </span>
                {count > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                    <Users className="size-3" /> {count} murid
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className={cn("grid gap-3", view === "week" && "grid-cols-2 md:grid-cols-7")}>
          {days.map((d) => {
            const count = schedulesByDay.get(dayKey(d))?.length ?? 0;
            const isSelected = dayKey(d) === selectedDate;
            return (
              <button
                key={dayKey(d)}
                onClick={() => setSelectedDate(dayKey(d))}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors hover:border-primary/50",
                  isSelected && "border-primary bg-primary/10",
                  isToday(d) && !isSelected && "border-primary/40"
                )}
              >
                <p className="text-sm font-semibold capitalize">
                  {format(d, "EEEE, d MMM", { locale: id })}
                </p>
                <p
                  className={cn(
                    "mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold",
                    count > 0 ? "bg-primary/10 text-primary" : "text-muted-foreground"
                  )}
                >
                  <Users className="size-3" /> {count > 0 ? `${count} murid` : "Tidak ada jadwal"}
                </p>
              </button>
            );
          })}
        </div>
      )}

      <div>
        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <CalendarDays className="size-4 text-primary" /> Jadwal{" "}
          <DateText
            value={parse(selectedDate, "yyyy-MM-dd", new Date())}
            tz={timezone}
            variant="dayDate"
          />
        </h3>
        {selectedSchedules.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Tidak ada jadwal pada tanggal ini."
            description="Klik tanggal lain di kalender untuk melihat murid yang diajar."
          />
        ) : (
          <div className="space-y-3">
            {selectedSchedules.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
              >
                <button className="min-w-0 flex-1 text-left" onClick={() => setDetail(s)}>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-lg font-bold leading-none">
                        <DateText value={s.start_at} tz={timezone} variant="time" />
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <DateText value={s.end_at} tz={timezone} variant="time" />
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold">{s.student_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {s.subject_name}
                        {s.grade_level ? ` · Kelas ${s.grade_level} ${s.school_level ?? ""}` : ""}
                        {s.learning_mode
                          ? ` · ${LEARNING_MODES[s.learning_mode as keyof typeof LEARNING_MODES] ?? s.learning_mode}`
                          : ""}
                      </p>
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <ScheduleStatusBadge status={s.status} startAt={s.start_at} endAt={s.end_at} />
                  <Button size="sm" onClick={() => setCompleting(s)}>
                    <CheckCircle2 className="size-4" /> Selesaikan
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {completing && (
        <CompleteSessionDialog
          open={!!completing}
          onOpenChange={(o) => !o && setCompleting(null)}
          schedule={completing}
          defaultDuration={defaultDuration}
          onSuccess={() => {
            setCompleting(null);
            router.refresh();
          }}
        />
      )}

      {detail && (
        <ScheduleDetailDialog
          schedule={detail}
          timezone={timezone}
          open={!!detail}
          onOpenChange={(o) => !o && setDetail(null)}
        />
      )}
    </div>
  );
}

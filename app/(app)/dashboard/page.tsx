import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DateText } from "@/components/shared/date-text";
import { QuickActions } from "@/components/dashboard/quick-actions";
import {
  DashboardSchedule,
  type DashboardScheduleItem,
} from "@/components/dashboard/dashboard-schedule";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard" };

interface DashboardStats {
  schedules_today: number;
  active_students: number;
  open_invoices: number;
  month_income: number;
  today_schedules: unknown[];
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const view =
    typeof sp.view === "string" && ["day", "week", "month"].includes(sp.view)
      ? (sp.view as "day" | "week" | "month")
      : "month";
  const dateStr = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)
    ? sp.date
    : format(new Date(), "yyyy-MM-dd");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, timezone")
    .eq("id", user!.id)
    .single();
  const tz = profile?.timezone ?? "Asia/Jakarta";

  const { data: settings } = await supabase
    .from("settings")
    .select("default_duration_minutes")
    .eq("user_id", user!.id)
    .single();

  const { data: statsData } = await supabase.rpc("get_dashboard_stats");
  const stats = (statsData ?? {
    schedules_today: 0,
    active_students: 0,
    open_invoices: 0,
    month_income: 0,
    today_schedules: [],
  }) as unknown as DashboardStats;

  // Pertemuan bulan ini
  const monthStart = toDateInput(fromZonedTime(startOfMonth(new Date()), tz));
  const nextMonthStart = toDateInput(
    fromZonedTime(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1), tz)
  );
  const { count: monthSessions } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user!.id)
    .eq("status", "completed")
    .gte("session_date", monthStart)
    .lt("session_date", nextMonthStart);

  // Jadwal untuk kalender (rentang sesuai view; terjadwal + selesai, dibatalkan disembunyikan)
  const d = parse(dateStr, "yyyy-MM-dd", new Date());
  let rangeStart: Date;
  let rangeEnd: Date;
  if (view === "day") {
    rangeStart = startOfDay(d);
    rangeEnd = endOfDay(d);
  } else if (view === "week") {
    rangeStart = startOfWeek(d, { weekStartsOn: 1 });
    rangeEnd = endOfWeek(d, { weekStartsOn: 1 });
  } else {
    rangeStart = startOfWeek(startOfMonth(d), { weekStartsOn: 1 });
    rangeEnd = endOfWeek(endOfMonth(d), { weekStartsOn: 1 });
  }

  const { data: schedules } = await supabase
    .from("schedules")
    .select(
      "id, start_at, end_at, status, learning_mode, location, notes, recurrence_rule, student_id, students(full_name, grade_level, school_level), subjects(name)"
    )
    .eq("user_id", user!.id)
    .in("status", ["scheduled", "completed"])
    .gte("start_at", fromZonedTime(rangeStart, tz).toISOString())
    .lte("start_at", fromZonedTime(rangeEnd, tz).toISOString())
    .order("start_at")
    .limit(1000);

  // Materi/PR/catatan dari pertemuan yang sudah tercatat (untuk opsi Isi Materi)
  const scheduleIds = (schedules ?? []).map((s) => s.id);
  const sessionsBySchedule = new Map<
    string,
    {
      id: string;
      material: string | null;
      sub_material: string | null;
      homework: string | null;
      progress_notes: string | null;
    }
  >();
  if (scheduleIds.length > 0) {
    const { data: sessionRows } = await supabase
      .from("sessions")
      .select("id, schedule_id, material, sub_material, homework, progress_notes")
      .in("schedule_id", scheduleIds);
    for (const r of sessionRows ?? []) {
      if (r.schedule_id) sessionsBySchedule.set(r.schedule_id, r);
    }
  }

  const items: DashboardScheduleItem[] = (schedules ?? []).map((s) => {
    const student = s.students as unknown as {
      full_name: string;
      grade_level: string | null;
      school_level: string | null;
    };
    return {
      id: s.id,
      start_at: s.start_at,
      end_at: s.end_at,
      status: s.status,
      learning_mode: s.learning_mode,
      location: s.location,
      notes: s.notes,
      recurrence_rule: s.recurrence_rule,
      student_id: s.student_id,
      student_name: student.full_name,
      subject_name: (s.subjects as unknown as { name: string }).name,
      grade_level: student.grade_level,
      school_level: student.school_level,
      session: sessionsBySchedule.get(s.id) ?? null,
    };
  });

  const hasStudents = stats.active_students > 0;
  const firstName = (profile?.full_name ?? "Guru").split(" ")[0] || "Guru";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Selamat datang, ${firstName}`}
        description={
          <DateText value={new Date()} tz={tz} variant="dayDate" className="text-muted-foreground" />
        }
      />

      {!hasStudents && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="font-semibold">Belum ada siswa.</p>
              <p className="text-sm text-muted-foreground">
                Mulai dengan menambahkan siswa pertamamu.
              </p>
            </div>
            <Button asChild>
              <Link href="/students/new">
                <UserPlus className="size-4" /> Tambah Siswa Pertama
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Jadwal Hari Ini" value={stats.schedules_today} />
        <StatCard icon={Users} label="Siswa Aktif" value={stats.active_students} href="/students" />
        <StatCard
          icon={Wallet}
          label="Belum Bayar"
          value={stats.open_invoices}
          hint="Tagihan belum lunas"
          href="/students?tab=payments"
        />
        <StatCard
          icon={BookOpen}
          label="Pertemuan Bulan Ini"
          value={monthSessions ?? 0}
          href="/sessions"
        />
      </div>

      <QuickActions />

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4 text-primary" /> Jadwal
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/schedule/new">Buat Jadwal</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <DashboardSchedule
            schedules={items}
            date={dateStr}
            view={view}
            timezone={tz}
            defaultDuration={settings?.default_duration_minutes ?? 90}
            basePath="/dashboard"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function toDateInput(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

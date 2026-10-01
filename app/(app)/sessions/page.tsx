import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { AttendanceBadge } from "@/components/shared/badges";
import { DateText } from "@/components/shared/date-text";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MonthFilter, StudentFilter } from "@/components/sessions/sessions-filters";
import {
  buildMonthOptions,
  startOfMonthTz,
  endOfMonthTz,
  todayInTz,
  toDateInput,
} from "@/lib/utils/date";

export const metadata: Metadata = { title: "Pertemuan" };

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const studentId = typeof sp.student === "string" ? sp.student : "";
  const month =
    typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month)
      ? sp.month
      : toDateInput(todayInTz("Asia/Jakarta"), "Asia/Jakarta").slice(0, 7);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user!.id)
    .single();
  const tz = profile?.timezone ?? "Asia/Jakarta";

  const [year, monthNum] = month.split("-").map(Number);
  const monthStart = toDateInput(
    startOfMonthTz(new Date(year, monthNum - 1, 1), tz),
    tz
  );
  const monthEnd = toDateInput(endOfMonthTz(new Date(year, monthNum - 1, 1), tz), tz);

  const [{ data: students }, { data: sessions }, { data: attendance }] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name")
      .eq("user_id", user!.id)
      .is("deleted_at", null)
      .order("full_name"),
    supabase
      .from("sessions")
      .select("id, student_id, session_date, duration_minutes, material, students(full_name), subjects(name)")
      .eq("user_id", user!.id)
      .eq("status", "completed")
      .gte("session_date", monthStart)
      .lte("session_date", monthEnd)
      .order("session_date", { ascending: false })
      .limit(500),
    supabase.from("attendance").select("session_id, status").eq("user_id", user!.id),
  ]);

  const attMap = new Map((attendance ?? []).map((a) => [a.session_id, a.status]));
  const filtered = studentId ? (sessions ?? []).filter((s) => s.student_id === studentId) : (sessions ?? []);

  const monthOptions = buildMonthOptions(month);

  return (
    <div>
      <PageHeader title="Pertemuan" description="Catatan kegiatan belajar per pertemuan." />
      <div className="mb-4 mt-4 flex flex-wrap items-end gap-3">
        <MonthFilter month={month} monthOptions={monthOptions} />
        <StudentFilter students={students ?? []} studentId={studentId} />
        {studentId && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/sessions">Reset Siswa</Link>
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Belum ada pertemuan bulan ini."
          description="Pertemuan tercatat otomatis saat jadwal diselesaikan."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Siswa</TableHead>
                <TableHead>Mapel</TableHead>
                <TableHead>Durasi</TableHead>
                <TableHead>Materi</TableHead>
                <TableHead>Kehadiran</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <DateText value={s.session_date} tz={tz} variant="shortDate" />
                  </TableCell>
                  <TableCell className="font-medium">
                    {(s.students as unknown as { full_name: string }).full_name}
                  </TableCell>
                  <TableCell>
                    {(s.subjects as unknown as { name: string } | null)?.name ?? "—"}
                  </TableCell>
                  <TableCell>{s.duration_minutes ? `${s.duration_minutes} mnt` : "—"}</TableCell>
                  <TableCell className="max-w-48 truncate">{s.material ?? "—"}</TableCell>
                  <TableCell>
                    <AttendanceBadge status={attMap.get(s.id) ?? "hadir"} />
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/sessions/${s.id}`}>Lihat</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

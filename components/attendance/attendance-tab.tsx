import { ClipboardCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AttendanceTable, type AttendanceRow } from "@/components/attendance/attendance-table";
import { StatusFilter } from "@/components/attendance/status-filter";
import { MonthFilter, StudentFilter } from "@/components/sessions/sessions-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { buildMonthOptions, startOfMonthTz, toDateInput } from "@/lib/utils/date";

export async function AttendanceTabContent({
  month,
  studentId,
  status,
}: {
  month: string;
  studentId: string;
  status: string;
}) {
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
  const monthStart = toDateInput(startOfMonthTz(new Date(year, monthNum - 1, 1), tz), tz);
  const nextMonthStart = toDateInput(startOfMonthTz(new Date(year, monthNum, 1), tz), tz);

  const [{ data: students }, { data: attendance }] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name")
      .eq("user_id", user!.id)
      .is("deleted_at", null)
      .order("full_name"),
    supabase
      .from("attendance")
      .select(
        "id, status, note, student_id, students(full_name), sessions(session_date, started_at, duration_minutes, material, subjects(name))"
      )
      .eq("user_id", user!.id)
      .gte("created_at", monthStart)
      .lt("created_at", nextMonthStart)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const rows: AttendanceRow[] = (attendance ?? [])
    .filter((a) => (!studentId || a.student_id === studentId) && (!status || a.status === status))
    .map((a) => {
      const session = a.sessions as unknown as {
        session_date: string;
        started_at: string | null;
        duration_minutes: number | null;
        material: string | null;
        subjects: { name: string } | null;
      } | null;
      return {
        id: a.id,
        status: a.status,
        note: a.note,
        student_name: (a.students as unknown as { full_name: string }).full_name,
        session_date: session?.session_date ?? "",
        started_at: session?.started_at ?? null,
        duration_minutes: session?.duration_minutes ?? null,
        material: session?.material ?? null,
        subject_name: session?.subjects?.name ?? null,
      };
    });

  const monthOptions = buildMonthOptions(month);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <MonthFilter month={month} monthOptions={monthOptions} />
        <StudentFilter students={students ?? []} studentId={studentId} />
        <StatusFilter status={status} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Belum ada presensi bulan ini."
          description="Presensi tercatat otomatis saat pertemuan diselesaikan."
        />
      ) : (
        <AttendanceTable rows={rows} timezone={tz} />
      )}
    </div>
  );
}

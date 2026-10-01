import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { format, getISODay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { StudentForm } from "@/components/students/student-form";
import type { SchoolLevel } from "@/lib/constants";

export const metadata: Metadata = { title: "Edit Siswa" };

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: student }, { data: subjects }, { data: links }, { data: profile }, { data: settings }, { data: activePackage }, { data: upcomingSchedules }] =
    await Promise.all([
      supabase
        .from("students")
        .select("*, parents(name, whatsapp)")
        .eq("id", id)
        .is("deleted_at", null)
        .single(),
      supabase
        .from("subjects")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name"),
      supabase.from("student_subjects").select("subject_id").eq("student_id", id),
      supabase
        .from("profiles")
        .select("teaching_levels, learning_mode, timezone")
        .eq("id", user.id)
        .single(),
      supabase
        .from("settings")
        .select("default_duration_minutes")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("student_packages")
        .select("total_sessions, price, per_session_rate, start_date")
        .eq("student_id", id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("schedules")
        .select("start_at, location")
        .eq("student_id", id)
        .eq("status", "scheduled")
        .order("start_at")
        .limit(100),
    ]);
  if (!student) notFound();

  const parent = student.parents as unknown as { name: string; whatsapp: string } | null;

  // Pola jadwal mendatang → hari + jam, tanggal mulai, dan lokasi untuk prefill form.
  const tz = profile?.timezone ?? "Asia/Jakarta";
  const scheduleByDay = new Map<number, string>();
  let scheduleStartDate = "";
  let scheduleLocation = "";
  for (const s of upcomingSchedules ?? []) {
    const local = toZonedTime(s.start_at, tz);
    const day = getISODay(local);
    if (!scheduleByDay.has(day)) scheduleByDay.set(day, format(local, "HH:mm"));
    if (!scheduleStartDate) scheduleStartDate = format(local, "yyyy-MM-dd");
    if (!scheduleLocation) scheduleLocation = s.location ?? "";
  }
  const scheduleTimes = [...scheduleByDay.entries()]
    .map(([day, start_time]) => ({ day, start_time }))
    .sort((a, b) => a.day - b.day);

  return (
    <div>
      <PageHeader title={`Edit Siswa — ${student.full_name}`} />
      <StudentForm
        subjects={subjects ?? []}
        schoolLevels={profile?.teaching_levels as SchoolLevel[] | undefined}
        defaultLearningMode={
          (profile?.learning_mode as "offline" | "online" | "hybrid" | undefined) ?? "offline"
        }
        defaultDurationMinutes={settings?.default_duration_minutes ?? 90}
        initial={{
          id: student.id,
          full_name: student.full_name,
          gender: (student.gender as "L" | "P" | null) ?? null,
          birth_date: student.birth_date ?? "",
          school_name: student.school_name ?? "",
          school_level: student.school_level,
          grade_level: student.grade_level,
          phone: student.phone ?? "",
          parent_name: parent?.name ?? "",
          parent_whatsapp: parent?.whatsapp ?? "",
          address: student.address ?? "",
          notes: student.notes ?? "",
          learning_mode: student.learning_mode,
          billing_type: student.billing_type,
          per_session_rate: student.per_session_rate,
          monthly_fee: student.monthly_fee,
          monthly_due_day: student.monthly_due_day,
          package_sessions: activePackage?.total_sessions ?? null,
          package_per_session_rate: activePackage?.per_session_rate ?? null,
          package_price: activePackage?.price ?? null,
          package_start_date: activePackage?.start_date ?? "",
          schedule_times: scheduleTimes,
          schedule_location: scheduleLocation,
          schedule_start_date: scheduleStartDate,
          status: student.status,
          subject_ids: (links ?? []).map((l) => l.subject_id),
        }}
      />
    </div>
  );
}

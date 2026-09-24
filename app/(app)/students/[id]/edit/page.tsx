import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
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

  const [{ data: student }, { data: subjects }, { data: links }, { data: profile }, { data: settings }] =
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
        .select("teaching_levels, learning_mode")
        .eq("id", user.id)
        .single(),
      supabase
        .from("settings")
        .select("default_duration_minutes")
        .eq("user_id", user.id)
        .single(),
    ]);
  if (!student) notFound();

  const parent = student.parents as unknown as { name: string; whatsapp: string } | null;

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
          status: student.status,
          subject_ids: (links ?? []).map((l) => l.subject_id),
        }}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { StudentForm } from "@/components/students/student-form";
import type { SchoolLevel } from "@/lib/constants";

export const metadata: Metadata = { title: "Edit Identitas" };

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

  const [{ data: student }, { data: profile }] = await Promise.all([
    supabase.from("students").select("*, parents(name, whatsapp)")
      .eq("id", id).eq("user_id", user.id).is("deleted_at", null).single(),
    supabase.from("profiles").select("teaching_levels, timezone").eq("id", user.id).single(),
  ]);
  if (!student) notFound();

  const parent = student.parents as unknown as { name: string; whatsapp: string } | null;

  return (
    <div>
      <PageHeader title={`Edit Identitas — ${student.full_name}`} />
      <StudentForm
        mode="identity"
        subjects={[]}
        schoolLevels={profile?.teaching_levels as SchoolLevel[] | undefined}
        timezone={profile?.timezone ?? "Asia/Jakarta"}
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
        }}
      />
    </div>
  );
}

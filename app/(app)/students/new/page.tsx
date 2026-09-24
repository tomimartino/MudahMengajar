import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { StudentForm } from "@/components/students/student-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import type { SchoolLevel } from "@/lib/constants";

export const metadata: Metadata = { title: "Tambah Siswa" };

export default async function NewStudentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: subjects }, { data: profile }, { data: settings }] = await Promise.all([
    supabase
      .from("subjects")
      .select("id, name")
      .eq("user_id", user!.id)
      .order("name"),
    supabase
      .from("profiles")
      .select("teaching_levels, learning_mode")
      .eq("id", user!.id)
      .single(),
    supabase
      .from("settings")
      .select("default_duration_minutes")
      .eq("user_id", user!.id)
      .single(),
  ]);

  if (!subjects || subjects.length === 0) {
    return (
      <div>
        <PageHeader title="Tambah Siswa" />
        <EmptyState
          icon={BookOpen}
          title="Belum ada mata pelajaran."
          description="Tambahkan mata pelajaran terlebih dahulu di Pengaturan, lalu kembali ke sini."
          action={
            <Button asChild>
              <Link href="/settings">Buka Pengaturan</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Tambah Siswa"
        description="Isi data siswa. Kolom bertanda * wajib diisi."
      />
      <StudentForm
        subjects={subjects}
        schoolLevels={profile?.teaching_levels as SchoolLevel[] | undefined}
        defaultLearningMode={
          (profile?.learning_mode as "offline" | "online" | "hybrid" | undefined) ?? "offline"
        }
        defaultDurationMinutes={settings?.default_duration_minutes ?? 90}
      />
    </div>
  );
}

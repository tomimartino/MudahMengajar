import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { ScheduleForm } from "@/components/schedule/schedule-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

export const metadata: Metadata = { title: "Buat Jadwal" };

export default async function NewSchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone, learning_mode")
    .eq("id", user!.id)
    .single();

  const [{ data: studentRows }, { data: subjects }, { data: links }, { data: settings }] =
    await Promise.all([
      supabase
        .from("students")
        .select("id, full_name")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .is("deleted_at", null)
        .order("full_name"),
      supabase.from("subjects").select("id, name").eq("user_id", user!.id).order("name"),
      supabase.from("student_subjects").select("student_id, subject_id"),
      supabase
        .from("settings")
        .select("default_duration_minutes")
        .eq("user_id", user!.id)
        .single(),
    ]);

  if (!studentRows || studentRows.length === 0) {
    return (
      <div>
        <PageHeader title="Buat Jadwal" />
        <EmptyState
          icon={Users}
          title="Belum ada siswa aktif."
          description="Tambahkan siswa terlebih dahulu sebelum membuat jadwal."
          action={
            <Button asChild>
              <Link href="/students/new">Tambah Siswa</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const students = studentRows.map((s) => ({
    id: s.id,
    full_name: s.full_name,
    subject_ids: (links ?? []).filter((l) => l.student_id === s.id).map((l) => l.subject_id),
  }));

  return (
    <div>
      <PageHeader
        title="Buat Jadwal"
        description="Jadwal satu kali atau berulang. Sistem akan memperingatkan jika terjadi bentrok."
      />
      <ScheduleForm
        students={students}
        subjects={subjects ?? []}
        timezone={profile?.timezone ?? "Asia/Jakarta"}
        defaultDurationMinutes={settings?.default_duration_minutes ?? 90}
        defaultLearningMode={
          (profile?.learning_mode as "offline" | "online" | "hybrid" | undefined) ?? "offline"
        }
      />
    </div>
  );
}

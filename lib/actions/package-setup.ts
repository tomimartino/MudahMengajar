"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/actions/helpers";
import { buildSchedulePattern } from "@/lib/utils/schedule-pattern";
import { toDateInput } from "@/lib/utils/date";
import type { StudentFormInitial } from "@/components/students/student-form";

export interface PackageStudent {
  id: string;
  full_name: string;
  school_level: string;
  grade_level: string;
  school_name: string | null;
  status: string;
}

export interface PackageFormSetup {
  initial: StudentFormInitial;
  subjects: { id: string; name: string }[];
  defaultDurationMinutes: number;
}

/** Semua murid milik guru, terlepas dari pencarian/filter/paginasi halaman Murid. */
export async function listPackageStudentsAction(): Promise<ActionResult<PackageStudent[]>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Silakan masuk kembali.");

  const students: PackageStudent[] = [];
  const batchSize = 500;
  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await supabase.from("students")
      .select("id, full_name, school_level, grade_level, school_name, status")
      .eq("user_id", user.id).is("deleted_at", null)
      .order("full_name").order("id").range(offset, offset + batchSize - 1);
    if (error) return fail("Daftar murid belum dapat dimuat. Silakan coba lagi.");
    students.push(...(data ?? []));
    if (!data || data.length < batchSize) break;
  }
  return ok(students);
}

/** Muat isian awal hanya setelah murid dipilih; form paket tetap menggunakan StudentForm. */
export async function getPackageFormSetupAction(studentId: string): Promise<ActionResult<PackageFormSetup>> {
  if (!z.string().uuid().safeParse(studentId).success) return fail("Murid tidak ditemukan.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Silakan masuk kembali.");

  const { data: student, error: studentError } = await supabase.from("students")
    .select("id, full_name, learning_mode, status")
    .eq("id", studentId).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
  if (studentError) return fail("Data murid belum dapat dimuat. Silakan coba lagi.");
  if (!student) return fail("Murid tidak ditemukan.");

  const [links, subjects, activePackage, schedules, profile, settings] = await Promise.all([
    supabase.from("student_subjects").select("subject_id").eq("user_id", user.id).eq("student_id", studentId),
    supabase.from("subjects").select("id, name").eq("user_id", user.id).order("name"),
    supabase.from("student_packages").select("total_sessions, per_session_rate")
      .eq("user_id", user.id).eq("student_id", studentId).eq("status", "active")
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("schedules").select("start_at, location")
      .eq("user_id", user.id).eq("student_id", studentId).eq("status", "scheduled").order("start_at").limit(100),
    supabase.from("profiles").select("timezone").eq("id", user.id).single(),
    supabase.from("settings").select("default_duration_minutes").eq("user_id", user.id).maybeSingle(),
  ]);
  if ([links, subjects, activePackage, schedules, profile, settings].some((result) => result.error)) {
    return fail("Form paket belum dapat dimuat. Silakan coba lagi.");
  }
  const timezone = profile.data?.timezone ?? "Asia/Jakarta";
  const pattern = buildSchedulePattern(schedules.data, timezone);
  return ok({
    initial: {
      id: student.id,
      full_name: student.full_name,
      learning_mode: student.learning_mode,
      billing_type: "package",
      package_sessions: activePackage.data?.total_sessions ?? null,
      package_per_session_rate: activePackage.data?.per_session_rate ?? null,
      package_start_date: toDateInput(new Date()),
      schedule_times: pattern.times,
      schedule_location: pattern.location,
      schedule_start_date: pattern.startDate,
      subject_ids: (links.data ?? []).map((link) => link.subject_id),
      status: student.status,
    },
    subjects: subjects.data ?? [],
    defaultDurationMinutes: settings.data?.default_duration_minutes ?? 90,
  });
}

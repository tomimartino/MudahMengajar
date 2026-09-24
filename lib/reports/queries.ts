import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export interface ReportFilters {
  from: string;
  to: string;
  student: string;
}

export type ReportType =
  | "students"
  | "sessions"
  | "attendance"
  | "payments";

export interface ReportResult {
  headers: string[];
  rows: Record<string, unknown>[];
}

type Supabase = SupabaseClient<Database>;

const STATUS_LABEL: Record<string, string> = {
  hadir: "Hadir", izin: "Izin", sakit: "Sakit", alpha: "Alpha",
  dibatalkan_guru: "Dibatalkan Guru", dibatalkan_siswa: "Dibatalkan Siswa",
};

export async function buildReport(
  supabase: Supabase,
  userId: string,
  type: ReportType,
  f: ReportFilters
): Promise<ReportResult> {
  switch (type) {
    case "students":
      return buildStudentsReport(supabase, userId);
    case "sessions":
      return buildSessionsReport(supabase, userId, f);
    case "attendance":
      return buildAttendanceReport(supabase, userId, f);
    case "payments":
      return buildPaymentsReport(supabase, userId, f);
  }
}

async function buildStudentsReport(supabase: Supabase, userId: string) {
  const [{ data: students }, { data: links }, { data: subjects }, { data: sessions }, { data: attendance }, { data: packages }, { data: openInvoices }] =
    await Promise.all([
      supabase.from("students").select("*").eq("user_id", userId).is("deleted_at", null).order("full_name"),
      supabase.from("student_subjects").select("student_id, subject_id").eq("user_id", userId),
      supabase.from("subjects").select("id, name").eq("user_id", userId),
      supabase.from("sessions").select("student_id").eq("user_id", userId).eq("status", "completed"),
      supabase.from("attendance").select("student_id, status").eq("user_id", userId),
      supabase.from("student_packages").select("student_id, total_sessions, sessions_used").eq("user_id", userId).eq("status", "active"),
      supabase.from("invoices").select("student_id, amount").eq("user_id", userId).in("status", ["unpaid", "partial"]),
    ]);

  const subjectMap = new Map((subjects ?? []).map((s) => [s.id, s.name]));
  const subjectNames = new Map<string, string[]>();
  for (const l of links ?? []) {
    const arr = subjectNames.get(l.student_id) ?? [];
    arr.push(subjectMap.get(l.subject_id) ?? "?");
    subjectNames.set(l.student_id, arr);
  }
  const sessionCount = new Map<string, number>();
  for (const s of sessions ?? []) sessionCount.set(s.student_id, (sessionCount.get(s.student_id) ?? 0) + 1);
  const hadirCount = new Map<string, number>();
  for (const a of attendance ?? []) {
    if (a.status === "hadir") hadirCount.set(a.student_id, (hadirCount.get(a.student_id) ?? 0) + 1);
  }
  const pkgMap = new Map<string, number>();
  for (const p of packages ?? []) pkgMap.set(p.student_id, p.total_sessions - p.sessions_used);
  const openSum = new Map<string, number>();
  for (const i of openInvoices ?? []) openSum.set(i.student_id, (openSum.get(i.student_id) ?? 0) + Number(i.amount));

  const rows = (students ?? []).map((s) => {
    const total = sessionCount.get(s.id) ?? 0;
    const hadir = hadirCount.get(s.id) ?? 0;
    return {
      Nama: s.full_name,
      Jenjang: s.school_level,
      Kelas: s.school_level === "Umum" ? "Umum" : s.grade_level,
      Sekolah: s.school_name ?? "",
      Status: s.status === "active" ? "Aktif" : "Nonaktif",
      "Mata Pelajaran": (subjectNames.get(s.id) ?? []).join(", "),
      "Total Pertemuan": total,
      Hadir: hadir,
      "Kehadiran (%)": total > 0 ? Math.round((hadir / total) * 100) : 0,
      "Sisa Paket": pkgMap.get(s.id) ?? "",
      "Tagihan Belum Lunas": openSum.get(s.id) ?? 0,
    };
  });

  return {
    headers: ["Nama", "Jenjang", "Kelas", "Sekolah", "Status", "Mata Pelajaran", "Total Pertemuan", "Hadir", "Kehadiran (%)", "Sisa Paket", "Tagihan Belum Lunas"],
    rows,
  };
}

async function buildSessionsReport(supabase: Supabase, userId: string, f: ReportFilters) {
  let q = supabase
    .from("sessions")
    .select("*, students(full_name), subjects(name), attendance(status)")
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("session_date", f.from)
    .lte("session_date", f.to)
    .order("session_date");
  if (f.student) q = q.eq("student_id", f.student);
  const { data } = await q.limit(2000);

  const rows = (data ?? []).map((s) => ({
    Tanggal: s.session_date,
    Siswa: (s.students as unknown as { full_name: string }).full_name,
    "Mata Pelajaran": (s.subjects as unknown as { name: string } | null)?.name ?? "",
    "Durasi (menit)": s.duration_minutes ?? "",
    Materi: s.material ?? "",
    Kehadiran: STATUS_LABEL[((s.attendance as unknown as { status: string }[])?.[0]?.status ?? "")] ?? "",
    Nilai: s.score ?? "",
  }));
  return {
    headers: ["Tanggal", "Siswa", "Mata Pelajaran", "Durasi (menit)", "Materi", "Kehadiran", "Nilai"],
    rows,
  };
}

async function buildAttendanceReport(supabase: Supabase, userId: string, f: ReportFilters) {
  let q = supabase
    .from("attendance")
    .select("*, students(full_name), sessions(session_date, started_at, duration_minutes, material)")
    .eq("user_id", userId)
    .gte("created_at", f.from)
    .lt("created_at", `${f.to}T23:59:59`)
    .order("created_at", { ascending: false });
  if (f.student) q = q.eq("student_id", f.student);
  const { data } = await q.limit(2000);

  const rows = (data ?? []).map((a) => {
    const s = a.sessions as unknown as {
      session_date: string;
      started_at: string | null;
      duration_minutes: number | null;
      material: string | null;
    } | null;
    return {
      Tanggal: s?.session_date ?? "",
      Siswa: (a.students as unknown as { full_name: string }).full_name,
      Status: STATUS_LABEL[a.status] ?? a.status,
      "Durasi (menit)": s?.duration_minutes ?? "",
      Materi: s?.material ?? "",
    };
  });
  return { headers: ["Tanggal", "Siswa", "Status", "Durasi (menit)", "Materi"], rows };
}

async function buildPaymentsReport(supabase: Supabase, userId: string, f: ReportFilters) {
  let q = supabase
    .from("payments")
    .select("*, students(full_name)")
    .eq("user_id", userId)
    .gte("payment_date", f.from)
    .lte("payment_date", f.to)
    .order("payment_date");
  if (f.student) q = q.eq("student_id", f.student);
  const { data } = await q.limit(2000);

  const rows = (data ?? []).map((p) => ({
    Tanggal: p.payment_date,
    Siswa: (p.students as unknown as { full_name: string }).full_name,
    Jenis: p.type,
    Nominal: Number(p.amount),
    Metode: p.method,
  }));
  return { headers: ["Tanggal", "Siswa", "Jenis", "Nominal", "Metode"], rows };
}

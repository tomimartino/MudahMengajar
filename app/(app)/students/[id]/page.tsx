import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/shared/badges";
import { StudentActions } from "@/components/students/student-actions";
import {
  AttendanceTab,
  NotesTab,
  OverviewTab,
  PaymentsTab,
  ScheduleTab,
  ScoresTab,
  SessionsTab,
} from "@/components/students/student-tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BILLING_TYPES, LEARNING_MODES } from "@/lib/constants";
import { buildWaLink } from "@/lib/utils/whatsapp";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Detail Siswa" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "schedule", label: "Jadwal" },
  { key: "sessions", label: "Pertemuan" },
  { key: "attendance", label: "Presensi" },
  { key: "scores", label: "Nilai" },
  { key: "payments", label: "Pembayaran" },
  { key: "notes", label: "Catatan" },
] as const;

export default async function StudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab = TABS.some((t) => t.key === tab) ? (tab as (typeof TABS)[number]["key"]) : "overview";

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

  const { data: student } = await supabase
    .from("students")
    .select("*, parents(name, whatsapp)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (!student) notFound();

  const { data: links } = await supabase
    .from("student_subjects")
    .select("subject_id, subjects(name)")
    .eq("student_id", id);

  const parent = student.parents as unknown as { name: string; whatsapp: string } | null;
  const initials = student.full_name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="bg-primary/10 text-lg font-bold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{student.full_name}</h1>
              {student.status === "active" ? (
                <StatusBadge tone="green">Aktif</StatusBadge>
              ) : (
                <StatusBadge tone="gray">Nonaktif</StatusBadge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {student.school_level === "Umum" ? "Umum" : `Kelas ${student.grade_level} ${student.school_level}`}
              {student.school_name ? ` · ${student.school_name}` : ""}
              {` · ${LEARNING_MODES[student.learning_mode as keyof typeof LEARNING_MODES] ?? student.learning_mode}`}
              {` · ${BILLING_TYPES[student.billing_type as keyof typeof BILLING_TYPES] ?? student.billing_type}`}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {(links ?? []).map((l) => (
                <Badge key={l.subject_id} variant="secondary" className="font-normal">
                  {(l.subjects as unknown as { name: string }).name}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {parent?.whatsapp && (
            <Button asChild variant="outline" size="sm">
              <a
                href={buildWaLink(parent.whatsapp, `Halo Bapak/Ibu ${parent.name},`)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="size-4" /> {parent.name || "Wali"}
              </a>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={`/students/${id}/edit`}>
              <Pencil className="size-4" /> Edit
            </Link>
          </Button>
          <StudentActions studentId={student.id} studentName={student.full_name} status={student.status} />
        </div>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/students/${id}?tab=${t.key}`}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              activeTab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {activeTab === "overview" && <OverviewTab studentId={id} timezone={tz} />}
      {activeTab === "schedule" && <ScheduleTab studentId={id} timezone={tz} />}
      {activeTab === "sessions" && <SessionsTab studentId={id} timezone={tz} />}
      {activeTab === "attendance" && <AttendanceTab studentId={id} timezone={tz} />}
      {activeTab === "scores" && <ScoresTab studentId={id} timezone={tz} />}
      {activeTab === "payments" && <PaymentsTab studentId={id} timezone={tz} />}
      {activeTab === "notes" && <NotesTab studentId={id} timezone={tz} />}
    </div>
  );
}

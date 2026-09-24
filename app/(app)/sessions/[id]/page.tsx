import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AttendanceBadge, StatusBadge } from "@/components/shared/badges";
import { DateText } from "@/components/shared/date-text";
import { AttendanceEditForm, SessionEditForm } from "@/components/sessions/session-edit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildWaLink, learningReportMessage } from "@/lib/utils/whatsapp";

export const metadata: Metadata = { title: "Detail Pertemuan" };

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const [{ data: session }, { data: settings }] = await Promise.all([
    supabase
      .from("sessions")
      .select("*, students(full_name, parents(name, whatsapp)), subjects(name), attendance(id, status, note)")
      .eq("id", id)
      .eq("user_id", user!.id)
      .single(),
    supabase
      .from("settings")
      .select("message_template_report")
      .eq("user_id", user!.id)
      .single(),
  ]);
  if (!session) notFound();

  const studentName = (session.students as unknown as { full_name: string }).full_name;
  const studentParent = (
    session.students as unknown as {
      parents: { name: string; whatsapp: string } | null;
    }
  )?.parents;
  const subjectName = (session.subjects as unknown as { name: string } | null)?.name ?? "—";
  const att = (session.attendance as unknown as { id: string; status: string; note: string | null }[])?.[0];

  const reportLink = studentParent?.whatsapp
    ? buildWaLink(
        studentParent.whatsapp,
        learningReportMessage(
          {
            parentName: studentParent.name || "Wali",
            studentName,
            sessionDate: session.session_date,
            material: session.material ?? "—",
            score: session.score,
            notes: session.learning_notes ?? "—",
            homework: session.homework ?? "—",
          },
          tz,
          settings?.message_template_report
        )
      )
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/sessions">
            <ArrowLeft className="size-4" /> Kembali ke Pertemuan
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <DateText value={session.session_date} tz={tz} />
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {studentName} · {subjectName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {reportLink && (
              <Button asChild variant="outline" size="sm">
                <a href={reportLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4 text-emerald-600" /> Kirim Laporan via WhatsApp
                </a>
              </Button>
            )}
            {att && <AttendanceBadge status={att.status} />}
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-5 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Waktu</p>
            <p className="text-sm font-medium">
              {session.started_at ? (
                <>
                  <DateText value={session.started_at} tz={tz} variant="time" />
                  {session.ended_at && (
                    <>
                      {" – "}
                      <DateText value={session.ended_at} tz={tz} variant="time" />
                    </>
                  )}
                </>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Durasi</p>
            <p className="text-sm font-medium">
              {session.duration_minutes ? `${session.duration_minutes} menit` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Nilai</p>
            <p className="text-sm font-medium">{session.score ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <StatusBadge tone={session.status === "completed" ? "green" : "gray"}>
              {session.status === "completed" ? "Selesai" : "Dibatalkan"}
            </StatusBadge>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">Siswa</p>
            <Button asChild variant="link" size="sm" className="h-auto p-0 text-sm">
              <Link href={`/students/${session.student_id}`}>{studentName}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <AttendanceEditForm attendanceId={att?.id ?? ""} status={att?.status ?? "hadir"} note={att?.note ?? null} />
        <SessionEditForm session={session} />
      </div>
    </div>
  );
}

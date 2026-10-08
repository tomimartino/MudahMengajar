import Link from "next/link";
import { getPortalAccess } from "@/lib/portal";
import { exitPortalAction } from "@/lib/actions/portal";
import { FileLinks } from "@/components/learning/learning-page";
import type { LearningFile } from "@/types/learning.types";
import { PortalRefresh } from "@/components/portal/portal-refresh";
import { Logo } from "@/components/shared/logo";
import { DateText } from "@/components/shared/date-text";
import { AmountText } from "@/components/shared/amount-text";
import { ATTENDANCE_STATUS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Portal Orang Tua",
  robots: { index: false, follow: false },
};

export default async function ParentPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const access = await getPortalAccess();
  if (!access) {
    return (
      <main className="mx-auto flex min-h-svh w-full min-w-0 max-w-xl flex-col justify-center gap-5 p-6">
        <Logo />
        <Card>
          <CardHeader><CardTitle>Portal Orang Tua</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Akses portal belum tersedia atau tautan sudah kedaluwarsa.
            </p>
            <Button asChild variant="outline"><Link href="/login">Masuk sebagai guru</Link></Button>
          </CardContent>
        </Card>
      </main>
    );
  }
  const { db, student } = access;
  const { tab = "schedule" } = await searchParams;
  const [profile, schedules, sessions, attendance, invoices, tasks] = await Promise.all([
    db.from("profiles").select("full_name,business_name,timezone")
      .eq("id", student.user_id).single(),
    db.from("schedules").select("id,subject_id,start_at,end_at,learning_mode,location")
      .eq("user_id", student.user_id).eq("student_id", student.id)
      .eq("status", "scheduled").gt("end_at", new Date().toISOString())
      .order("start_at").limit(100),
    db.from("sessions").select("id,subject_id,session_date,material,sub_material,learning_notes,homework,progress_notes,score")
      .eq("user_id", student.user_id).eq("student_id", student.id)
      .eq("status", "completed").order("session_date", { ascending: false }).limit(100),
    db.from("attendance").select("session_id,status")
      .eq("user_id", student.user_id).eq("student_id", student.id).limit(1000),
    db.rpc("portal_invoice_balances", { p_hash: access.hash }),
    db.from("homework_tasks").select("id,title,description,status,due_date,files").eq("user_id",student.user_id).eq("student_id",student.id).order("created_at",{ascending:false}).limit(100),
  ]);
  if ([profile, schedules, sessions, attendance, invoices, tasks].some((result) => result.error)) {
    throw new Error("Portal belum dapat dimuat. Coba lagi.");
  }
  const subjectIds = [...new Set([
    ...(sessions.data ?? []).map((session) => session.subject_id),
    ...(schedules.data ?? []).map((schedule) => schedule.subject_id),
  ].filter((id): id is string => Boolean(id)))];
  const subjects = subjectIds.length
    ? await db.from("subjects").select("id,name").eq("user_id", student.user_id).in("id", subjectIds)
    : { data: [], error: null };
  if (subjects.error) throw new Error("Jadwal belum dapat dimuat.");
  const subjectNames = new Map((subjects.data ?? []).map((subject) => [subject.id, subject.name]));
  const tz = profile.data?.timezone ?? "Asia/Jakarta";
  const att = new Map((attendance.data ?? []).map((item) => [item.session_id, item.status]));
  const homework = tasks.data ?? [];
  const invoiceRows = (invoices.data ?? []) as unknown as {
    id: string; invoice_number: string; period_label: string | null;
    amount: string; due_date: string | null; status: string; paid_total: number;
  }[];
  const tabs = [
    ["schedule", "Jadwal"], ["learning", "Belajar & Presensi"],
    ["homework", "PR"], ["billing", "Pembayaran"],
  ];
  const active = tabs.some(([key]) => key === tab) ? tab : "schedule";
  return (
    <main className="mx-auto min-h-svh w-full min-w-0 max-w-5xl space-y-6 px-4 py-6 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Logo />
        <div className="flex gap-2">
          <PortalRefresh />
          <form action={exitPortalAction}><Button size="sm" variant="ghost">Keluar portal</Button></form>
        </div>
      </header>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Portal Orang Tua · {profile.data?.business_name || profile.data?.full_name}
        </p>
        <h1 className="text-3xl font-bold">{student.full_name}</h1>
        <p className="text-sm text-muted-foreground">{student.school_level} · Kelas {student.grade_level}</p>
      </div>
      <nav aria-label="Navigasi portal" className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(([key, label]) => (
          <Link key={key} href={`/portal?tab=${key}`} aria-current={active === key ? "page" : undefined}
            className={`shrink-0 rounded-xl border px-4 py-2 text-sm ${active === key ? "bg-primary text-primary-foreground" : "bg-card"}`}>
            {label}
          </Link>
        ))}
      </nav>
      {active === "schedule" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {!schedules.data?.length && <p className="text-muted-foreground">Belum ada jadwal mendatang.</p>}
          {(schedules.data ?? []).map((schedule) => (
            <Card key={schedule.id}><CardContent className="space-y-3 p-5">
              <p className="font-semibold">{subjectNames.get(schedule.subject_id) ?? "Pertemuan"}</p>
              <p className="text-sm"><DateText value={schedule.start_at} tz={tz} variant="dateTime" /> – <DateText value={schedule.end_at} tz={tz} variant="time" /></p>
              <p className="break-words text-sm text-muted-foreground">{schedule.learning_mode}{schedule.location ? ` · ${schedule.location}` : ""}</p>
            </CardContent></Card>
          ))}
        </div>
      )}
      {active === "learning" && (
        <div className="space-y-4">
          {!sessions.data?.length && <p className="text-muted-foreground">Belum ada pertemuan selesai.</p>}
          {(sessions.data ?? []).map((session) => (
            <Card key={session.id}>
              <CardHeader><div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">{subjectNames.get(session.subject_id ?? "") ?? "Pertemuan"} · <DateText value={session.session_date} tz={tz} /></CardTitle>
                {att.has(session.id) && <Badge variant="secondary">{ATTENDANCE_STATUS[att.get(session.id) as keyof typeof ATTENDANCE_STATUS] ?? att.get(session.id)}</Badge>}
              </div></CardHeader>
              <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
                {[
                  ["Materi", session.material], ["Sub materi", session.sub_material],
                  ["Catatan belajar", session.learning_notes], ["PR", session.homework],
                  ["Perkembangan", session.progress_notes], ["Nilai", session.score],
                ].filter(([, value]) => value !== null && value !== "").map(([label, value]) => (
                  <div key={label}><p className="mb-1 text-xs text-muted-foreground">{label}</p><p className="whitespace-pre-wrap break-words">{value}</p></div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {active === "homework" && (
        <div className="grid items-start gap-4 sm:grid-cols-2">
          {!homework.length && <p className="text-muted-foreground">Belum ada PR.</p>}
          {homework.map(task=><Card key={task.id}><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-base">{task.title}</CardTitle><Badge variant="secondary">{task.status==="completed"?"Selesai":"Ditugaskan"}</Badge></div>{task.due_date&&<p className="text-sm text-muted-foreground">Tenggat: <DateText value={task.due_date} tz={tz}/></p>}</CardHeader><CardContent className="space-y-3"><p className="whitespace-pre-wrap break-words text-sm">{task.description}</p><FileLinks files={task.files as unknown as LearningFile[]} kind="homework" id={task.id} portal/></CardContent></Card>)}
        </div>
      )}
      {active === "billing" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {!invoiceRows.length && <p className="text-muted-foreground">Belum ada tagihan.</p>}
          {invoiceRows.map((invoice) => {
            const remaining = Math.max(0, Number(invoice.amount) - Number(invoice.paid_total));
            return (
              <Card key={invoice.id}>
                <CardHeader>
                  <div className="flex justify-between gap-2">
                    <CardTitle className="text-base">{invoice.invoice_number}</CardTitle>
                    <Badge variant="secondary">{remaining === 0 ? "Lunas" : Number(invoice.paid_total) > 0 ? "Sebagian" : "Belum bayar"}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{invoice.period_label}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm"><span>Total</span><AmountText value={invoice.amount} /></div>
                  <div className="flex justify-between text-sm"><span>Terbayar</span><AmountText value={invoice.paid_total} /></div>
                  <div className="flex justify-between font-semibold"><span>Sisa</span><AmountText value={remaining} /></div>
                  {invoice.due_date && <p className="text-xs text-muted-foreground">Jatuh tempo: <DateText value={invoice.due_date} tz={tz} /></p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}

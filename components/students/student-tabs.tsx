import Link from "next/link";
import { CalendarDays, ClipboardCheck, Eye, NotebookPen, ReceiptText, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AttendanceBadge, InvoiceStatusBadge, ScheduleStatusBadge, StatusBadge } from "@/components/shared/badges";
import { DateText } from "@/components/shared/date-text";
import { AmountText } from "@/components/shared/amount-text";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PackagePanel, type PackageRow } from "@/components/students/package-form";
import { CreateInvoiceDialog } from "@/components/payments/invoice-create-dialog";
import { todayInTz, toDateInput } from "@/lib/utils/date";
import { LEARNING_MODES } from "@/lib/constants";
import { invoiceBalances, loadBillingLedger } from "@/lib/finance/data";

// ============================= OVERVIEW =============================

export async function OverviewTab({ studentId, timezone }: { studentId: string; timezone: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: sessions }, { data: attendance }, { data: activePkg }, { data: packages }, ledger, { data: nextSched }] =
    await Promise.all([
      supabase.from("sessions").select("id, session_date, score, status").eq("student_id", studentId).eq("status", "completed").order("session_date", { ascending: false }).order("id"),
      supabase.from("attendance").select("status").eq("student_id", studentId),
      supabase.from("student_packages").select("*").eq("student_id", studentId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("student_packages").select("*").eq("student_id", studentId).order("created_at", { ascending: false }).limit(10),
      loadBillingLedger(supabase, user.id, studentId),
      supabase.from("schedules").select("id, start_at, end_at, status, subject_id, subjects(name)").eq("student_id", studentId).eq("status", "scheduled").gt("start_at", new Date().toISOString()).order("start_at").limit(1).maybeSingle(),
    ]);

  const total = sessions?.length ?? 0;
  const hadir = (attendance ?? []).filter((a) => a.status === "hadir").length;
  const pct = total > 0 ? Math.round((hadir / total) * 100) : 0;
  const scores = (sessions ?? []).filter((s) => s.score !== null).map((s) => Number(s.score));
  const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const lastSession = (sessions ?? [])[0]?.session_date ?? null;
  const balances = invoiceBalances(ledger.invoices, ledger.payments);
  const openInvoices = ledger.invoices.filter((i) => i.status !== "paid");
  const unpaidTotal = openInvoices.reduce((sum, i) => sum + (balances.get(i.id) ?? 0), 0);
  const remaining = activePkg ? activePkg.total_sessions - activePkg.sessions_used : null;

  const pkgRows: PackageRow[] = (packages ?? []).map((p) => ({
    id: p.id,
    total_sessions: p.total_sessions,
    price: Number(p.price),
    start_date: p.form_settings && typeof p.form_settings === "object" && !Array.isArray(p.form_settings)
      && typeof p.form_settings.schedule_start_date === "string" ? p.form_settings.schedule_start_date : null,
    due_date: p.start_date,
    status: p.status,
    sessions_used: p.sessions_used,
  }));

  const stats = [
    { label: "Total pertemuan", value: total },
    { label: "Hadir", value: hadir },
    { label: "Kehadiran", value: `${pct}%` },
    { label: "Sisa paket", value: remaining !== null ? `${remaining}` : "—" },
    { label: "Tagihan belum lunas", value: <AmountText value={unpaidTotal} /> },
    { label: "Rata-rata nilai", value: avg !== null ? String(avg) : "—" },
  ];

  const lastSessionText = lastSession ? (
    <DateText value={lastSession} tz={timezone} />
  ) : (
    "—"
  );
  const nextScheduleText = nextSched?.start_at ? (
    <span>
      <DateText value={nextSched.start_at} tz={timezone} variant="shortDate" /> ·{" "}
      <DateText value={nextSched.start_at} tz={timezone} variant="time" />
    </span>
  ) : (
    "—"
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-lg font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pertemuan terakhir</p>
            <p className="mt-1 text-sm font-bold">{lastSessionText}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Jadwal berikutnya</p>
            <p className="mt-1 text-sm font-bold">{nextScheduleText}</p>
          </CardContent>
        </Card>
      </div>

      <PackagePanel packages={pkgRows} timezone={timezone} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tagihan Belum Lunas</CardTitle>
        </CardHeader>
        <CardContent>
          {(openInvoices ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada tagihan yang belum lunas.</p>
          ) : (
            <div className="space-y-2">
              {openInvoices!.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">
                      {i.period_label ?? i.invoice_number} · <AmountText value={balances.get(i.id) ?? 0} />
                    </p>
                    {i.due_date && (
                      <p className="text-xs text-muted-foreground">
                        Jatuh tempo <DateText value={i.due_date} tz={timezone} />
                      </p>
                    )}
                  </div>
                  <InvoiceStatusBadge
                    status={i.status}
                    dueDate={i.due_date}
                    today={toDateInput(todayInTz(timezone), timezone)}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================= SCHEDULE =============================

export async function ScheduleTab({ studentId, timezone }: { studentId: string; timezone: string }) {
  const supabase = await createClient();
  const { data: schedules } = await supabase
    .from("schedules")
    .select("id, start_at, end_at, status, learning_mode, location, recurrence_rule, subjects(name)")
    .eq("student_id", studentId)
    .order("start_at", { ascending: false })
    .limit(30);

  if (!schedules || schedules.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Belum ada jadwal."
      />
    );
  }

  return (
    <div className="space-y-2">
      {schedules.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <div>
            <p className="font-medium">
              <DateText value={s.start_at} tz={timezone} variant="dayDate" />
            </p>
            <p className="text-sm text-muted-foreground">
              <DateText value={s.start_at} tz={timezone} variant="time" /> –{" "}
              <DateText value={s.end_at} tz={timezone} variant="time" />
              {s.learning_mode ? ` · ${LEARNING_MODES[s.learning_mode as keyof typeof LEARNING_MODES] ?? s.learning_mode}` : ""}
              {s.location ? ` · ${s.location}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(s.subjects as unknown as { name: string } | null)?.name && (
              <StatusBadge tone="blue">
                {(s.subjects as unknown as { name: string }).name}
              </StatusBadge>
            )}
            <ScheduleStatusBadge status={s.status} startAt={s.start_at} endAt={s.end_at} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================= SESSIONS =============================

export async function SessionsTab({ studentId, timezone }: { studentId: string; timezone: string }) {
  const supabase = await createClient();
  const [{ data: sessions }, { data: attendance }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, session_date, duration_minutes, material, subjects(name)")
      .eq("student_id", studentId)
      .eq("status", "completed")
      .order("session_date", { ascending: false })
      .limit(50),
    supabase.from("attendance").select("session_id, status").eq("student_id", studentId),
  ]);

  if (!sessions || sessions.length === 0) {
    return <EmptyState icon={ClipboardCheck} title="Belum ada pertemuan." />;
  }

  const attMap = new Map((attendance ?? []).map((a) => [a.session_id, a.status]));

  return (
    <div className="space-y-2">
      {sessions.map((s) => (
        <Link
          key={s.id}
          href={`/sessions/${s.id}`}
          className="flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors hover:border-primary/40"
        >
          <div>
            <p className="font-medium">
              <DateText value={s.session_date} tz={timezone} variant="shortDate" /> ·{" "}
              {(s.subjects as unknown as { name: string } | null)?.name ?? "—"}
            </p>
            <p className="text-sm text-muted-foreground">
              {s.material || "Tanpa materi"} · {s.duration_minutes ?? "?"} menit
            </p>
          </div>
          <AttendanceBadge status={attMap.get(s.id) ?? "alpha"} />
        </Link>
      ))}
    </div>
  );
}

// ============================= SCORES =============================

export async function ScoresTab({ studentId, timezone }: { studentId: string; timezone: string }) {
  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, session_date, material, score")
    .eq("student_id", studentId)
    .not("score", "is", null)
    .order("session_date", { ascending: false })
    .limit(100);

  if (!sessions || sessions.length === 0) {
    return <EmptyState icon={Star} title="Belum ada nilai." />;
  }

  return (
    <div className="space-y-2">
      {sessions.map((s) => (
        <Link
          key={s.id}
          href={`/sessions/${s.id}`}
          className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:border-primary/40"
        >
          <div>
            <p className="font-medium">{s.material || "Tanpa judul materi"}</p>
            <p className="text-sm text-muted-foreground">
              <DateText value={s.session_date} tz={timezone} />
            </p>
          </div>
          <span className="text-lg font-bold text-primary">{s.score}</span>
        </Link>
      ))}
    </div>
  );
}

// ============================= PAYMENTS =============================

export async function PaymentsTab({ studentId, timezone }: { studentId: string; timezone: string }) {
  const supabase = await createClient();
  const [{ data: invoices }, { data: payments }, { data: student }] = await Promise.all([
    supabase.from("invoices").select("*").eq("student_id", studentId).order("created_at", { ascending: false }),
    supabase.from("payments").select("*").eq("student_id", studentId).order("payment_date", { ascending: false }),
    supabase.from("students").select("full_name").eq("id", studentId).single(),
  ]);

  const today = toDateInput(todayInTz(timezone), timezone);
  const PAYMENT_METHODS: Record<string, string> = {
    cash: "Cash",
    bank_transfer: "Transfer Bank",
    ewallet: "E-Wallet",
    other: "Lainnya",
  };
  const studentName = student?.full_name ?? "Siswa";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <ReceiptText className="size-4 text-primary" /> Tagihan & Pembayaran
        </h3>
        <CreateInvoiceDialog
          students={[{ id: studentId, full_name: studentName }]}
          initialStudentId={studentId}
        />
      </div>

      {(!invoices || invoices.length === 0) && (!payments || payments.length === 0) ? (
        <EmptyState icon={ReceiptText} title="Belum ada tagihan atau pembayaran." />
      ) : (
        <>
          {(invoices ?? []).length > 0 && (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tagihan</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead>Nominal</TableHead>
                    <TableHead>Jatuh Tempo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-14">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices!.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.invoice_number}</TableCell>
                      <TableCell>{i.period_label ?? "—"}</TableCell>
                      <TableCell>
                        <AmountText value={i.amount} />
                      </TableCell>
                      <TableCell>
                        {i.due_date ? <DateText value={i.due_date} tz={timezone} /> : "—"}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={i.status} dueDate={i.due_date} today={today} />
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="icon-sm" aria-label="Lihat tagihan">
                          <Link href={`/invoices/${i.id}`}>
                            <Eye className="size-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {(payments ?? []).length > 0 && (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Nominal</TableHead>
                    <TableHead>Metode</TableHead>
                    <TableHead>Catatan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments!.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <DateText value={p.payment_date} tz={timezone} />
                      </TableCell>
                      <TableCell>{PAYMENT_METHODS[p.type] ?? p.type}</TableCell>
                      <TableCell>
                        <AmountText value={p.amount} />
                      </TableCell>
                      <TableCell>{PAYMENT_METHODS[p.method] ?? p.method}</TableCell>
                      <TableCell className="max-w-48 truncate">{p.notes ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================= NOTES =============================

export async function NotesTab({ studentId, timezone }: { studentId: string; timezone: string }) {
  const supabase = await createClient();
  const [{ data: student }, { data: sessions }] = await Promise.all([
    supabase.from("students").select("notes").eq("id", studentId).single(),
    supabase
      .from("sessions")
      .select("id, session_date, material, learning_notes, progress_notes, homework")
      .eq("student_id", studentId)
      .order("session_date", { ascending: false })
      .limit(30),
  ]);

  const notes = (sessions ?? []).filter(
    (s) => s.learning_notes || s.progress_notes || s.homework
  );

  if (!student?.notes && notes.length === 0) {
    return <EmptyState icon={NotebookPen} title="Belum ada catatan." />;
  }

  return (
    <div className="space-y-6">
      {student?.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Catatan Siswa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{student.notes}</p>
          </CardContent>
        </Card>
      )}
      {notes.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Catatan Pembelajaran</p>
          {notes.map((s) => (
            <Card key={s.id}>
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-semibold">
                  {s.material || "Pertemuan"} ·{" "}
                  <DateText value={s.session_date} tz={timezone} variant="shortDate" />
                </p>
                {s.learning_notes && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Pembelajaran: </span>
                    {s.learning_notes}
                  </p>
                )}
                {s.homework && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">PR: </span>
                    {s.homework}
                  </p>
                )}
                {s.progress_notes && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Perkembangan: </span>
                    {s.progress_notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

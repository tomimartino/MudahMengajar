import Link from "next/link";
import { CalendarDays, ClipboardCheck, NotebookPen, ReceiptText, Star } from "lucide-react";
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
import {
  AdjustPackageButton,
  CancelPackageButton,
  CreatePackageButton,
} from "@/components/students/package-form";
import { CreateInvoiceDialog } from "@/components/payments/invoice-create-dialog";
import { todayInTz, toDateInput } from "@/lib/utils/date";
import { LEARNING_MODES } from "@/lib/constants";

// ============================= OVERVIEW =============================

export async function OverviewTab({ studentId, timezone }: { studentId: string; timezone: string }) {
  const supabase = await createClient();
  const [{ data: sessions }, { data: attendance }, { data: activePkg }, { data: packages }, { data: openInvoices }, { data: nextSched }] =
    await Promise.all([
      supabase.from("sessions").select("id, session_date, score, status").eq("student_id", studentId).eq("status", "completed"),
      supabase.from("attendance").select("status").eq("student_id", studentId),
      supabase.from("student_packages").select("*").eq("student_id", studentId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("student_packages").select("*").eq("student_id", studentId).order("created_at", { ascending: false }).limit(10),
      supabase.from("invoices").select("id, invoice_number, period_label, amount, due_date, status").eq("student_id", studentId).in("status", ["unpaid", "partial"]),
      supabase.from("schedules").select("id, start_at, end_at, status, subject_id, subjects(name)").eq("student_id", studentId).eq("status", "scheduled").gt("start_at", new Date().toISOString()).order("start_at").limit(1).maybeSingle(),
    ]);

  const total = sessions?.length ?? 0;
  const hadir = (attendance ?? []).filter((a) => a.status === "hadir").length;
  const izin = (attendance ?? []).filter((a) => a.status === "izin").length;
  const sakit = (attendance ?? []).filter((a) => a.status === "sakit").length;
  const alpha = (attendance ?? []).filter((a) => a.status === "alpha").length;
  const pct = total > 0 ? Math.round((hadir / total) * 100) : 0;
  const scores = (sessions ?? []).filter((s) => s.score !== null).map((s) => Number(s.score));
  const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const lastSession = (sessions ?? [])[0]?.session_date ?? null;
  const unpaidTotal = (openInvoices ?? []).reduce((sum, i) => sum + Number(i.amount), 0);
  const remaining = activePkg ? activePkg.total_sessions - activePkg.sessions_used : null;

  const stats = [
    { label: "Total pertemuan", value: total },
    { label: "Hadir", value: hadir },
    { label: "Izin / Sakit / Alpha", value: `${izin} / ${sakit} / ${alpha}` },
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

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Paket Pertemuan</CardTitle>
          <CreatePackageButton studentId={studentId} />
        </CardHeader>
        <CardContent className="space-y-3">
          {activePkg ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
              <div>
                <p className="font-semibold">
                  {activePkg.total_sessions}x Pertemuan ·{" "}
                  <AmountText value={activePkg.price} />
                </p>
                <p className="text-sm text-muted-foreground">
                  Terpakai {activePkg.sessions_used} · Sisa{" "}
                  <span className="font-semibold text-primary">
                    {activePkg.total_sessions - activePkg.sessions_used}
                  </span>
                </p>
              </div>
              <div className="h-2 w-full rounded-full bg-muted sm:w-48">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{
                    width: `${Math.min(100, (activePkg.sessions_used / activePkg.total_sessions) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex gap-2">
                <AdjustPackageButton
                  packageId={activePkg.id}
                  currentUsed={activePkg.sessions_used}
                  total={activePkg.total_sessions}
                />
                <CancelPackageButton packageId={activePkg.id} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tidak ada paket aktif. Buat paket agar sisa pertemuan tercatat otomatis.
            </p>
          )}
          {(packages?.length ?? 0) > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Riwayat paket</p>
              <div className="space-y-2">
                {packages!.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span>
                      {p.total_sessions}x · <AmountText value={p.price} /> · mulai{" "}
                      <DateText value={p.start_date} tz={timezone} />
                    </span>
                    <StatusBadge tone={p.status === "active" ? "green" : p.status === "completed" ? "gray" : "red"}>
                      {p.status === "active" ? "Aktif" : p.status === "completed" ? "Selesai" : "Dibatalkan"}
                    </StatusBadge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
                      {i.period_label ?? i.invoice_number} · <AmountText value={i.amount} />
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
        action={
          <Button asChild>
            <Link href="/schedule/new">Buat Jadwal</Link>
          </Button>
        }
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
    return <EmptyState icon={ClipboardCheck} title="Belum ada pertemuan." description="Selesaikan jadwal untuk membuat catatan pertemuan." />;
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

// ============================= ATTENDANCE =============================

export async function AttendanceTab({ studentId, timezone }: { studentId: string; timezone: string }) {
  const supabase = await createClient();
  const [{ data: rows }, { data: sessions }] = await Promise.all([
    supabase
      .from("attendance")
      .select("id, session_id, status, note, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("sessions")
      .select("id, session_date, duration_minutes, material")
      .eq("student_id", studentId),
  ]);

  if (!rows || rows.length === 0) {
    return <EmptyState icon={ClipboardCheck} title="Belum ada riwayat presensi." />;
  }

  const sMap = new Map((sessions ?? []).map((s) => [s.id, s]));
  const counts = { hadir: 0, izin: 0, sakit: 0, alpha: 0, dibatalkan: 0 };
  for (const r of rows) {
    if (r.status === "hadir") counts.hadir++;
    else if (r.status === "izin") counts.izin++;
    else if (r.status === "sakit") counts.sakit++;
    else if (r.status === "alpha") counts.alpha++;
    else counts.dibatalkan++;
  }
  const total = rows.length;
  const pct = total > 0 ? Math.round((counts.hadir / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {[
          ["Hadir", counts.hadir],
          ["Izin", counts.izin],
          ["Sakit", counts.sakit],
          ["Alpha", counts.alpha],
          ["Kehadiran", `${pct}%`],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Durasi</TableHead>
              <TableHead>Materi</TableHead>
              <TableHead>Catatan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const s = sMap.get(r.session_id);
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    {s ? <DateText value={s.session_date} tz={timezone} variant="shortDate" /> : "—"}
                  </TableCell>
                  <TableCell>
                    <AttendanceBadge status={r.status} />
                  </TableCell>
                  <TableCell>{s?.duration_minutes ? `${s.duration_minutes} mnt` : "—"}</TableCell>
                  <TableCell className="max-w-56 truncate">{s?.material ?? "—"}</TableCell>
                  <TableCell className="max-w-40 truncate">{r.note ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
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
    return <EmptyState icon={Star} title="Belum ada nilai." description="Nilai tersimpan saat menyelesaikan pertemuan." />;
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

import { StudentActions } from "@/components/students/student-actions";
import { AttendanceBadge, StatusBadge } from "@/components/shared/badges";
import { DateText } from "@/components/shared/date-text";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface EnrichedStudent {
  id: string;
  full_name: string;
  school_level: string;
  grade_level: string;
  school_name: string | null;
  status: string;
  billing_type: string;
  parent_name: string | null;
  parent_whatsapp: string | null;
  subject_names: string[];
  package_remaining: number | null;
  package_total: number | null;
  payment_state: "paid" | "partial" | "unpaid" | "overdue" | "none";
  upcoming_count: number;
  next_start_at: string | null;
}

export function StudentTable({
  students,
  timezone,
}: {
  students: EnrichedStudent[];
  timezone: string;
}) {
  if (students.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Kelas</TableHead>
            <TableHead>Mapel</TableHead>
            <TableHead>Jadwal</TableHead>
            <TableHead>Paket</TableHead>
            <TableHead>Sisa</TableHead>
            <TableHead>Pembayaran</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((s) => (
            <TableRow key={s.id}>
              <TableCell>
                <p className="font-medium">{s.full_name}</p>
                <p className="text-xs text-muted-foreground">{s.school_name ?? "—"}</p>
              </TableCell>
              <TableCell>
                {s.school_level === "Umum" ? "Umum" : `Kelas ${s.grade_level} ${s.school_level}`}
              </TableCell>
              <TableCell>
                <div className="flex max-w-40 flex-wrap gap-1">
                  {s.subject_names.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    s.subject_names.map((n) => (
                      <Badge key={n} variant="secondary" className="font-normal">
                        {n}
                      </Badge>
                    ))
                  )}
                </div>
              </TableCell>
              <TableCell>
                {s.next_start_at ? (
                  <div>
                    <DateText value={s.next_start_at} tz={timezone} variant="shortDate" className="font-medium" />
                    <p className="text-xs text-muted-foreground">
                      <DateText value={s.next_start_at} tz={timezone} variant="time" />
                      {s.upcoming_count > 1 ? ` · +${s.upcoming_count - 1} lagi` : ""}
                    </p>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {s.package_total ? (
                  <p className="text-sm">
                    {s.package_total}x
                    <span className="text-xs text-muted-foreground"> ({s.billing_type === "package" ? "paket" : "—"})</span>
                  </p>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {s.package_remaining !== null ? (
                  <StatusBadge tone={s.package_remaining <= 2 ? "red" : s.package_remaining <= 4 ? "yellow" : "green"}>
                    {s.package_remaining} pertemuan
                  </StatusBadge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {s.payment_state === "none" && <span className="text-muted-foreground">—</span>}
                {s.payment_state === "paid" && <StatusBadge tone="green">Lunas</StatusBadge>}
                {s.payment_state === "partial" && <StatusBadge tone="yellow">Sebagian</StatusBadge>}
                {s.payment_state === "unpaid" && <StatusBadge tone="yellow">Belum Bayar</StatusBadge>}
                {s.payment_state === "overdue" && <StatusBadge tone="red">Jatuh Tempo</StatusBadge>}
              </TableCell>
              <TableCell>
                {s.status === "active" ? (
                  <AttendanceBadge status="hadir" />
                ) : (
                  <StatusBadge tone="gray">Nonaktif</StatusBadge>
                )}
              </TableCell>
              <TableCell>
                <StudentActions studentId={s.id} studentName={s.full_name} status={s.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StudentActions } from "@/components/students/student-actions";
import { StatusBadge } from "@/components/shared/badges";
import { DateText } from "@/components/shared/date-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EnrichedStudent } from "@/components/students/student-table";

export function StudentCard({
  student,
  timezone,
}: {
  student: EnrichedStudent;
  timezone: string;
}) {
  const paymentBadge =
    student.payment_state === "none" ? null : student.payment_state === "paid" ? (
      <StatusBadge tone="green">Lunas</StatusBadge>
    ) : student.payment_state === "partial" ? (
      <StatusBadge tone="yellow">Sebagian</StatusBadge>
    ) : student.payment_state === "overdue" ? (
      <StatusBadge tone="red">Jatuh Tempo</StatusBadge>
    ) : (
      <StatusBadge tone="yellow">Belum Bayar</StatusBadge>
    );

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/students/${student.id}`} className="min-w-0">
          <p className="truncate font-semibold">{student.full_name}</p>
          <p className="text-sm text-muted-foreground">
            {student.school_level === "Umum" ? "Umum" : `Kelas ${student.grade_level} ${student.school_level}`}
            {student.school_name ? ` · ${student.school_name}` : ""}
          </p>
        </Link>
        <StudentActions studentId={student.id} studentName={student.full_name} status={student.status} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {student.subject_names.map((n) => (
          <Badge key={n} variant="secondary" className="font-normal">
            {n}
          </Badge>
        ))}
      </div>

      <div className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Jadwal berikutnya</span>
          {student.next_start_at ? (
            <span className="font-medium">
              <DateText value={student.next_start_at} tz={timezone} variant="shortDate" /> ·{" "}
              <DateText value={student.next_start_at} tz={timezone} variant="time" />
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Sisa paket</span>
          {student.package_remaining !== null ? (
            <span className="font-medium">{student.package_remaining} pertemuan</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Pembayaran</span>
          {paymentBadge ?? <span className="text-muted-foreground">—</span>}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Status</span>
          {student.status === "active" ? (
            <StatusBadge tone="green">Aktif</StatusBadge>
          ) : (
            <StatusBadge tone="gray">Nonaktif</StatusBadge>
          )}
        </div>
      </div>

      <Button asChild variant="outline" size="sm" className="mt-3 w-full">
        <Link href={`/students/${student.id}`}>
          Lihat detail <ChevronRight className="size-4" />
        </Link>
      </Button>
    </div>
  );
}

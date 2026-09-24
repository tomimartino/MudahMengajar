import { Badge } from "@/components/ui/badge";
import { BADGE_STYLES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type BadgeTone = keyof typeof BADGE_STYLES;

export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("font-medium", BADGE_STYLES[tone], className)}>
      {children}
    </Badge>
  );
}

export function AttendanceBadge({ status }: { status: string }) {
  const map: Record<string, { tone: BadgeTone; label: string }> = {
    hadir: { tone: "green", label: "Hadir" },
    izin: { tone: "yellow", label: "Izin" },
    sakit: { tone: "yellow", label: "Sakit" },
    alpha: { tone: "red", label: "Alpha" },
    dibatalkan_guru: { tone: "gray", label: "Dibatalkan Guru" },
    dibatalkan_siswa: { tone: "gray", label: "Dibatalkan Siswa" },
  };
  const m = map[status] ?? { tone: "gray" as BadgeTone, label: status };
  return <StatusBadge tone={m.tone}>{m.label}</StatusBadge>;
}

export function InvoiceStatusBadge({
  status,
  dueDate,
  today,
}: {
  status: string;
  dueDate?: string | null;
  today?: string;
}) {
  if (status === "paid") return <StatusBadge tone="green">Lunas</StatusBadge>;
  if (status === "partial") return <StatusBadge tone="yellow">Sebagian</StatusBadge>;
  const overdue = dueDate && today ? dueDate < today : false;
  return overdue ? (
    <StatusBadge tone="red">Jatuh Tempo</StatusBadge>
  ) : (
    <StatusBadge tone="yellow">Belum Bayar</StatusBadge>
  );
}

export function ScheduleStatusBadge({
  status,
  startAt,
  endAt,
}: {
  status: string;
  startAt?: string | null;
  endAt?: string | null;
}) {
  if (status === "cancelled") return <StatusBadge tone="gray">Dibatalkan</StatusBadge>;
  if (status === "completed") return <StatusBadge tone="green">Selesai</StatusBadge>;
  // Status "Sedang Berlangsung" dihitung dari jam saat render.
  // eslint-disable-next-line react-hooks/purity -- status waktu bersifat volatile, bukan state aplikasi
  const now = Date.now();
  const started = startAt ? new Date(startAt).getTime() : Infinity;
  const ended = endAt ? new Date(endAt).getTime() : Infinity;
  if (now >= started && now < ended) {
    return <StatusBadge tone="yellow">Sedang Berlangsung</StatusBadge>;
  }
  return <StatusBadge tone="gray">Belum Dimulai</StatusBadge>;
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { toast } from "sonner";
import { ArrowLeftRight, Ban, CalendarRange, ExternalLink, MapPin, Pencil, Repeat2 } from "lucide-react";
import { cancelScheduleAction, switchScheduleAction } from "@/lib/actions/schedule";
import { ScheduleStatusBadge } from "@/components/shared/badges";
import { DateText } from "@/components/shared/date-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LEARNING_MODES } from "@/lib/constants";
import { PreviousSessionCard } from "@/components/schedule/previous-session-card";

export interface ScheduleItem {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  learning_mode: string | null;
  location: string | null;
  notes: string | null;
  recurrence_rule: unknown;
  student_id: string;
  student_name: string;
  subject_name: string;
}

export function ScheduleDetailDialog({
  schedule,
  timezone,
  open,
  onOpenChange,
  onEdit,
}: {
  schedule: ScheduleItem;
  timezone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  // Konfirmasi pembatalan + keterangan opsional
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelNote, setCancelNote] = useState("");

  // Pindah jadwal (switch)
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switchPending, setSwitchPending] = useState(false);
  const localStart = toZonedTime(new Date(schedule.start_at), timezone);
  const [switchDate, setSwitchDate] = useState(format(localStart, "yyyy-MM-dd"));
  const [switchTime, setSwitchTime] = useState(format(localStart, "HH:mm"));

  async function handleCancel() {
    setPending(true);
    try {
      const result = await cancelScheduleAction(schedule.id, cancelNote);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Jadwal dibatalkan.");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Jadwal belum dapat dibatalkan. Silakan coba lagi.");
    } finally {
      setPending(false);
    }
  }

  async function handleSwitch() {
    setSwitchPending(true);
    try {
      const result = await switchScheduleAction(schedule.id, { date: switchDate, time: switchTime });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Jadwal dipindahkan.");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Jadwal belum dapat dipindahkan. Silakan coba lagi.");
    } finally {
      setSwitchPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {schedule.student_name}
            <ScheduleStatusBadge
              status={schedule.status}
              startAt={schedule.start_at}
              endAt={schedule.end_at}
            />
          </DialogTitle>
          <DialogDescription>{schedule.subject_name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <CalendarRange className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              <DateText value={schedule.start_at} tz={timezone} variant="dayDate" />
              {" · "}
              <DateText value={schedule.start_at} tz={timezone} variant="time" /> –{" "}
              <DateText value={schedule.end_at} tz={timezone} variant="time" />
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Repeat2 className="size-4 shrink-0 text-muted-foreground" />
            <span>
              {schedule.recurrence_rule ? "Jadwal berulang" : "Jadwal satu kali"} ·{" "}
              {schedule.learning_mode
                ? LEARNING_MODES[schedule.learning_mode as keyof typeof LEARNING_MODES] ?? schedule.learning_mode
                : "—"}
            </span>
          </div>
          {schedule.location && (
            <div className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0 text-muted-foreground" />
              <span className="break-all">{schedule.location}</span>
            </div>
          )}
          {schedule.notes && <p className="text-muted-foreground">{schedule.notes}</p>}
          {open && schedule.status === "scheduled" && (
            <PreviousSessionCard key={schedule.id} scheduleId={schedule.id} timezone={timezone} />
          )}

          {switchOpen && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="move-schedule-date" className="text-xs text-muted-foreground">Tanggal</label>
                  <Input
                    id="move-schedule-date"
                    type="date"
                    value={switchDate}
                    disabled={switchPending}
                    onChange={(e) => setSwitchDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="move-schedule-time" className="text-xs text-muted-foreground">Jam</label>
                  <Input
                    id="move-schedule-time"
                    type="time"
                    value={switchTime}
                    disabled={switchPending}
                    onChange={(e) => setSwitchTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" disabled={switchPending} onClick={() => setSwitchOpen(false)}>
                  Batal
                </Button>
                <Button size="sm" disabled={switchPending} onClick={() => void handleSwitch()}>
                  {switchPending ? "Memindahkan..." : "Pindahkan"}
                </Button>
              </div>
            </div>
          )}

          {confirmCancel && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-1">
                <label htmlFor="cancel-schedule-note" className="text-xs text-muted-foreground">Keterangan (opsional)</label>
                <Textarea
                  id="cancel-schedule-note"
                  rows={2}
                  placeholder="Alasan pembatalan..."
                  value={cancelNote}
                  disabled={pending}
                  onChange={(e) => setCancelNote(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" disabled={pending} onClick={() => setConfirmCancel(false)}>
                  Batal
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  onClick={() => void handleCancel()}
                >
                  <Ban className="size-4" /> {pending ? "Membatalkan..." : "Batalkan"}
                </Button>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {schedule.status === "completed" && onEdit && (
            <Button variant="outline" size="sm" disabled={pending || switchPending} onClick={onEdit}>
              <Pencil className="size-4" /> Isi Materi
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={`/students/${schedule.student_id}`}>
              <ExternalLink className="size-4" /> Profil Siswa
            </Link>
          </Button>
          {(schedule.status === "scheduled" || schedule.status === "completed") && (
              <Button
                variant="outline"
                size="sm"
                disabled={pending || switchPending}
                onClick={() => {
                  setConfirmCancel(false);
                  setSwitchOpen(!switchOpen);
                }}
              >
                <ArrowLeftRight className="size-4" /> Pindah Jadwal
              </Button>
          )}
          {(schedule.status === "scheduled" || schedule.status === "completed") && (
              <Button
                variant="destructive"
                size="sm"
                disabled={pending || switchPending}
                onClick={() => {
                  setSwitchOpen(false);
                  setConfirmCancel(!confirmCancel);
                }}
              >
                <Ban className="size-4" /> Batalkan Jadwal
              </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

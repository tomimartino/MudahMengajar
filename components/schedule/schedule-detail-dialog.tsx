"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Ban, CalendarRange, ExternalLink, MapPin, Repeat2 } from "lucide-react";
import { cancelScheduleAction } from "@/lib/actions/schedule";
import { ScheduleStatusBadge } from "@/components/shared/badges";
import { DateText } from "@/components/shared/date-text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LEARNING_MODES } from "@/lib/constants";

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
}: {
  schedule: ScheduleItem;
  timezone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleCancel() {
    setPending(true);
    const result = await cancelScheduleAction(schedule.id);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Jadwal dibatalkan.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/students/${schedule.student_id}`}>
              <ExternalLink className="size-4" /> Profil Siswa
            </Link>
          </Button>
          {schedule.status === "scheduled" && (
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() => void handleCancel()}
            >
              <Ban className="size-4" /> {pending ? "Membatalkan..." : "Batalkan Jadwal"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

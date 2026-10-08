"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { BookOpen, ArrowUpRight } from "lucide-react";
import { getPreviousSessionAction } from "@/lib/actions/notifications";
import { DateText } from "@/components/shared/date-text";
import { Button } from "@/components/ui/button";
import type { PreviousSession } from "@/types/database.types";

export function PreviousSessionCard({ scheduleId, timezone }: { scheduleId: string; timezone: string }) {
  const [previous, setPrevious] = useState<PreviousSession | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    startTransition(async () => {
      const result = await getPreviousSessionAction(scheduleId);
      if (!active) return;
      setPrevious(result.data ?? null);
      setError(result.ok ? "" : result.error ?? "Materi sebelumnya gagal dimuat.");
      setLoaded(true);
    });
    return () => { active = false; };
  }, [scheduleId]);

  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!loaded) return <p role="status" className="text-sm text-muted-foreground">Memuat materi sebelumnya...</p>;
  if (!previous) return <p className="text-sm text-muted-foreground">Belum ada pertemuan sebelumnya untuk mata pelajaran ini.</p>;

  const sections = [
    ["Materi", previous.material], ["Submateri", previous.sub_material],
    ["PR", previous.homework], ["Catatan", previous.learning_notes], ["Progres", previous.progress_notes],
  ];
  const hasContent = sections.some(([, value]) => value?.trim());
  return (
    <section className="space-y-3 rounded-xl border bg-primary/5 p-4" aria-label="Materi pertemuan sebelumnya">
      <div className="flex items-center gap-2 font-semibold"><BookOpen className="size-4 text-primary" />Pertemuan sebelumnya</div>
      <DateText value={previous.session_date} tz={timezone} variant="date" className="text-xs text-muted-foreground" />
      {hasContent ? <dl className="space-y-2">
        {sections.map(([label, value]) => value?.trim() ? (
          <div key={label}><dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="whitespace-pre-wrap break-words">{value}</dd></div>
        ) : null)}
      </dl> : <p className="text-muted-foreground">Materi dan catatan belum diisi.</p>}
      <Button asChild size="sm" variant="outline"><Link href={`/sessions/${previous.id}`}>Buka Pertemuan<ArrowUpRight className="size-4" /></Link></Button>
    </section>
  );
}

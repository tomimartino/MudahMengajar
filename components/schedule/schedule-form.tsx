"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { addWeeks, format } from "date-fns";
import { TriangleAlert } from "lucide-react";
import { createScheduleAction } from "@/lib/actions/schedule";
import { scheduleSchema, type ScheduleInput } from "@/lib/validations/schedule";
import { DAY_NAMES, LEARNING_MODES, RECURRENCE_LABELS } from "@/lib/constants";
import { DateText } from "@/components/shared/date-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface ConflictItem {
  id: string;
  start_at: string;
  end_at: string;
  students?: { full_name: string } | { full_name: string }[] | null;
}

export function ScheduleForm({
  students,
  subjects,
  timezone,
  defaultDurationMinutes,
  defaultLearningMode,
}: {
  students: { id: string; full_name: string; subject_ids: string[] }[];
  subjects: { id: string; name: string }[];
  timezone: string;
  defaultDurationMinutes?: number;
  defaultLearningMode?: "offline" | "online" | "hybrid";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);

  const today = format(new Date(), "yyyy-MM-dd");
  const defaultUntil = format(addWeeks(new Date(), 12), "yyyy-MM-dd");

  const form = useForm<ScheduleInput>({
    resolver: zodResolver(scheduleSchema) as unknown as Resolver<ScheduleInput>,
    defaultValues: {
      student_id: "",
      subject_id: "",
      date: today,
      start_time: "16:00",
      learning_mode: defaultLearningMode ?? "offline",
      location: "",
      notes: "",
      recurrence: "none",
      custom_days: [],
      until: defaultUntil,
    },
  });

  const studentId = form.watch("student_id");
  const recurrence = form.watch("recurrence");
  const customDays = form.watch("custom_days") ?? [];

  const studentSubjects = studentId
    ? subjects.filter((s) => {
        const stu = students.find((x) => x.id === studentId);
        return stu?.subject_ids.includes(s.id);
      })
    : subjects;

  function toggleDay(day: number) {
    const next = customDays.includes(day)
      ? customDays.filter((d) => d !== day)
      : [...customDays, day];
    form.setValue("custom_days", next, { shouldValidate: true });
  }

  async function submit(values: ScheduleInput, confirm: boolean) {
    setPending(true);
    const result = await createScheduleAction(values, confirm);
    setPending(false);
    if (!result.ok) {
      if (result.conflict && result.conflicts) {
        setConflicts(result.conflicts as ConflictItem[]);
        toast.warning("Jadwal bertabrakan dengan jadwal siswa lain.");
        return;
      }
      toast.error(result.error);
      return;
    }
    setConflicts([]);
    toast.success("Jadwal berhasil dibuat.");
    router.push("/schedule");
    router.refresh();
  }

  const conflictNames = conflicts
    .map((c) => {
      const s = c.students;
      const name = Array.isArray(s) ? s[0]?.full_name : s?.full_name;
      return name ?? "Siswa lain";
    })
    .filter((v, i, a) => a.indexOf(v) === i);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => submit(v, false))} className="space-y-6">
        {conflicts.length > 0 && (
          <Alert className="border-amber-300 bg-amber-50 text-amber-900 [&_svg]:text-amber-600">
            <TriangleAlert className="size-4" />
            <AlertTitle>Jadwal bertabrakan dengan jadwal siswa lain.</AlertTitle>
            <AlertDescription className="text-amber-800/80">
              <p>
                {conflictNames.slice(0, 3).join(", ")}
                {conflictNames.length > 3 ? ", dll." : ""} sudah memiliki jadwal di waktu tersebut:
              </p>
              <ul className="mt-1 list-inside list-disc">
                {conflicts.slice(0, 3).map((c) => (
                  <li key={c.id}>
                    <DateText value={c.start_at} tz={timezone} variant="dateTime" /> –{" "}
                    <DateText value={c.end_at} tz={timezone} variant="time" />
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => form.handleSubmit((v) => submit(v, true))()}
                disabled={pending}
              >
                {pending ? "Menyimpan..." : "Tetap Buat Jadwal Ini"}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">SISWA & MAPEL</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="student_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Siswa *</FormLabel>
                  <Select
                    onValueChange={(v) => {
                      field.onChange(v);
                      const stu = students.find((x) => x.id === v);
                      if (stu?.subject_ids.length === 1) {
                        form.setValue("subject_id", stu.subject_ids[0]!);
                      }
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih siswa" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="subject_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mata pelajaran *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih mapel" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {studentSubjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">WAKTU</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="start_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jam mulai *</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {typeof defaultDurationMinutes === "number" && (
              <p className="self-end pb-2 text-xs text-muted-foreground">
                Durasi pertemuan {defaultDurationMinutes} menit (diatur di Pengaturan).
              </p>
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">PENGULANGAN</h2>
          <FormField
            control={form.control}
            name="recurrence"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Jadwal berulang</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {recurrence === "custom" && (
            <div className="mt-3 space-y-2">
              <FormLabel>Hari berulang</FormLabel>
              <div className="flex flex-wrap gap-2">
                {DAY_NAMES.map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleDay(i + 1)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      customDays.includes(i + 1)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/50 hover:text-primary"
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
              {form.formState.errors.custom_days && (
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.custom_days.message}
                </p>
              )}
            </div>
          )}

          {recurrence !== "none" && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="until"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Berulang sampai</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="self-end text-xs text-muted-foreground">
                Jadwal otomatis dibuat dari tanggal mulai hingga tanggal akhir.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">DETAIL</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="learning_mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mode belajar</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "offline"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(LEARNING_MODES).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lokasi / link meeting</FormLabel>
                  <FormControl>
                    <Input placeholder="Rumah siswa / https://zoom.us/j/..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Catatan</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Catatan tambahan..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Batal
          </Button>
          <SubmitButton pending={pending} loadingText="Menyimpan...">
            Buat Jadwal
          </SubmitButton>
        </div>
      </form>
    </Form>
  );
}

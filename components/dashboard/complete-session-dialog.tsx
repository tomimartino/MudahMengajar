"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { completeSessionAction } from "@/lib/actions/sessions";
import { switchScheduleAction } from "@/lib/actions/schedule";
import {
  completeSessionSchema,
  switchScheduleSchema,
  type CompleteSessionInput,
  type SwitchScheduleInput,
} from "@/lib/validations/session";
import { ATTENDANCE_STATUS } from "@/lib/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface ScheduleInfo {
  id: string;
  student_name: string;
  subject_name: string;
  start_at: string;
  end_at: string;
}

export function CompleteSessionDialog({
  open,
  onOpenChange,
  schedule,
  defaultDuration,
  timezone,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: ScheduleInfo;
  defaultDuration: number;
  timezone: string;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<"complete" | "switch">("complete");
  const [pending, setPending] = useState(false);
  const [switchPending, setSwitchPending] = useState(false);

  const durationMinutes = Math.round(
    (new Date(schedule.end_at).getTime() - new Date(schedule.start_at).getTime()) / 60000
  );
  const localStart = toZonedTime(new Date(schedule.start_at), timezone);

  useEffect(() => {
    if (open) setMode("complete");
  }, [open]);

  const form = useForm<CompleteSessionInput>({
    resolver: zodResolver(completeSessionSchema) as unknown as Resolver<CompleteSessionInput>,
    defaultValues: {
      attendance: "hadir",
      duration_minutes: defaultDuration,
      material: "",
      sub_material: "",
      learning_notes: "",
      homework: "",
      score: null,
      progress_notes: "",
    },
  });

  const switchForm = useForm<SwitchScheduleInput>({
    resolver: zodResolver(switchScheduleSchema) as unknown as Resolver<SwitchScheduleInput>,
    defaultValues: {
      date: format(localStart, "yyyy-MM-dd"),
      time: format(localStart, "HH:mm"),
    },
  });

  async function onSubmit(values: CompleteSessionInput) {
    setPending(true);
    const result = await completeSessionAction(schedule.id, values);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Pertemuan selesai dicatat.");
    onSuccess();
  }

  async function onSwitchSubmit(values: SwitchScheduleInput) {
    setSwitchPending(true);
    const result = await switchScheduleAction(schedule.id, values);
    setSwitchPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Jadwal dipindahkan.");
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "switch" ? "Switch Jadwal" : "Selesaikan Pertemuan"}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {schedule.student_name} · {schedule.subject_name}
          </p>
        </DialogHeader>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "complete" | "switch")}>
          <TabsList className="w-full">
            <TabsTrigger value="complete">Selesaikan</TabsTrigger>
            <TabsTrigger value="switch">Switch Jadwal</TabsTrigger>
          </TabsList>

          <TabsContent value="complete">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="attendance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kehadiran</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(ATTENDANCE_STATUS).map(([value, label]) => (
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
                    name="duration_minutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Durasi (menit)</FormLabel>
                        <FormControl>
                          <Input type="number" inputMode="numeric" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="material"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Materi</FormLabel>
                      <FormControl>
                        <Input placeholder="Contoh: Persamaan Linear" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sub_material"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Submateri</FormLabel>
                      <FormControl>
                        <Input placeholder="Contoh: Metode eliminasi" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="learning_notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Catatan pembelajaran</FormLabel>
                      <FormControl>
                        <Textarea rows={2} placeholder="Apa yang sudah dikuasai, apa yang perlu diulang..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="homework"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PR / tugas</FormLabel>
                      <FormControl>
                        <Textarea rows={2} placeholder="Contoh: Latihan 3 soal cerita halaman 45" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="score"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nilai (opsional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="decimal"
                            placeholder="0 - 100"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value)}
                            onBlur={field.onBlur}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="progress_notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Catatan perkembangan</FormLabel>
                        <FormControl>
                          <Input placeholder="Contoh: Semangat belajarnya naik" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Batal
                  </Button>
                  <SubmitButton pending={pending} loadingText="Menyimpan...">
                    Simpan Pertemuan
                  </SubmitButton>
                </div>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="switch">
            <Form {...switchForm}>
              <form onSubmit={switchForm.handleSubmit(onSwitchSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={switchForm.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tanggal</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={switchForm.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jam</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Durasi mengikuti jadwal asli ({durationMinutes} menit). Jadwal tetap berstatus
                  scheduled di tanggal dan jam baru.
                </p>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Batal
                  </Button>
                  <SubmitButton pending={switchPending} loadingText="Memindahkan...">
                    Pindahkan Jadwal
                  </SubmitButton>
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { completeSessionAction } from "@/lib/actions/sessions";
import { completeSessionSchema, type CompleteSessionInput } from "@/lib/validations/session";
import { ATTENDANCE_STATUS } from "@/lib/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: ScheduleInfo;
  defaultDuration: number;
  onSuccess: () => void;
}) {
  const [pending, setPending] = useState(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Selesaikan Pertemuan</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {schedule.student_name} · {schedule.subject_name}
          </p>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}

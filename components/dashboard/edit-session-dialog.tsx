"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { saveSessionForScheduleAction } from "@/lib/actions/sessions";
import {
  saveSessionForScheduleSchema,
  type SaveSessionForScheduleInput,
} from "@/lib/validations/session";
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
import { SubmitButton } from "@/components/shared/submit-button";

interface ScheduleInfo {
  id: string;
  student_name: string;
  subject_name: string;
  session: {
    material: string | null;
    sub_material: string | null;
    homework: string | null;
    progress_notes: string | null;
  } | null;
}

export function EditSessionDialog({
  open,
  onOpenChange,
  schedule,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: ScheduleInfo;
  onSuccess: () => void;
}) {
  const [pending, setPending] = useState(false);
  const form = useForm<SaveSessionForScheduleInput>({
    resolver: zodResolver(saveSessionForScheduleSchema) as unknown as Resolver<SaveSessionForScheduleInput>,
    defaultValues: {
      material: schedule.session?.material ?? "",
      sub_material: schedule.session?.sub_material ?? "",
      homework: schedule.session?.homework ?? "",
      progress_notes: schedule.session?.progress_notes ?? "",
    },
  });

  async function onSubmit(values: SaveSessionForScheduleInput) {
    setPending(true);
    const result = await saveSessionForScheduleAction(schedule.id, values);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Materi pertemuan tersimpan.");
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Isi Materi Pertemuan</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {schedule.student_name} · {schedule.subject_name}
          </p>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <SubmitButton pending={pending} loadingText="Menyimpan...">
                Simpan Materi
              </SubmitButton>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

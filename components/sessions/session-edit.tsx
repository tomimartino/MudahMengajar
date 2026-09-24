"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { updateAttendanceAction, updateSessionAction } from "@/lib/actions/sessions";
import {
  updateAttendanceSchema,
  updateSessionSchema,
  type UpdateAttendanceInput,
  type UpdateSessionInput,
} from "@/lib/validations/session";
import { ATTENDANCE_STATUS } from "@/lib/constants";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SessionEditForm({
  session,
}: {
  session: {
    id: string;
    duration_minutes: number | null;
    material: string | null;
    sub_material: string | null;
    learning_notes: string | null;
    homework: string | null;
    score: string | null;
    progress_notes: string | null;
  };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const form = useForm<UpdateSessionInput>({
    resolver: zodResolver(updateSessionSchema) as unknown as Resolver<UpdateSessionInput>,
    defaultValues: {
      duration_minutes: session.duration_minutes ?? 90,
      material: session.material ?? "",
      sub_material: session.sub_material ?? "",
      learning_notes: session.learning_notes ?? "",
      homework: session.homework ?? "",
      score: session.score ? Number(session.score) : null,
      progress_notes: session.progress_notes ?? "",
    },
  });

  async function onSubmit(values: UpdateSessionInput) {
    setPending(true);
    const result = await updateSessionAction(session.id, values);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Pertemuan berhasil diperbarui.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Catatan Pembelajaran</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
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
              <FormField
                control={form.control}
                name="score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nilai (0-100)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
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
                name="material"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Materi</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="learning_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan pembelajaran</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
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
                    <Textarea rows={2} {...field} />
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
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <SubmitButton pending={pending} loadingText="Menyimpan...">
                Simpan Perubahan
              </SubmitButton>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export function AttendanceEditForm({
  attendanceId,
  status,
  note,
}: {
  attendanceId: string;
  status: string;
  note: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const form = useForm<UpdateAttendanceInput>({
    resolver: zodResolver(updateAttendanceSchema) as unknown as Resolver<UpdateAttendanceInput>,
    defaultValues: { status: status as UpdateAttendanceInput["status"], note: note ?? "" },
  });

  async function onSubmit(values: UpdateAttendanceInput) {
    setPending(true);
    const result = await updateAttendanceAction(attendanceId, values);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Presensi berhasil diperbarui.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Presensi</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status kehadiran</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
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
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan</FormLabel>
                  <FormControl>
                    <Input placeholder="Catatan presensi..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <p className="text-xs text-muted-foreground">
              Mengubah presensi tidak mengubah potongan paket. Koreksi sisa paket lewat halaman
              siswa.
            </p>
            <div className="flex justify-end">
              <SubmitButton pending={pending} loadingText="Menyimpan...">
                Simpan Presensi
              </SubmitButton>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

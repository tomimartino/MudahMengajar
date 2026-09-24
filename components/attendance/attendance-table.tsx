"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { updateAttendanceAction } from "@/lib/actions/sessions";
import { updateAttendanceSchema, type UpdateAttendanceInput } from "@/lib/validations/session";
import { ATTENDANCE_STATUS } from "@/lib/constants";
import { AttendanceBadge } from "@/components/shared/badges";
import { DateText } from "@/components/shared/date-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SubmitButton } from "@/components/shared/submit-button";

export interface AttendanceRow {
  id: string;
  status: string;
  note: string | null;
  student_name: string;
  session_date: string;
  started_at: string | null;
  duration_minutes: number | null;
  material: string | null;
  subject_name: string | null;
}

export function AttendanceTable({ rows, timezone }: { rows: AttendanceRow[]; timezone: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AttendanceRow | null>(null);
  const [pending, setPending] = useState(false);

  const form = useForm<UpdateAttendanceInput>({
    resolver: zodResolver(updateAttendanceSchema) as unknown as Resolver<UpdateAttendanceInput>,
    defaultValues: { status: "hadir", note: "" },
  });

  function openEdit(row: AttendanceRow) {
    form.reset({ status: row.status as UpdateAttendanceInput["status"], note: row.note ?? "" });
    setEditing(row);
  }

  async function onSubmit(values: UpdateAttendanceInput) {
    if (!editing) return;
    setPending(true);
    const result = await updateAttendanceAction(editing.id, values);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Presensi berhasil diperbarui.");
    setEditing(null);
    router.refresh();
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Jam</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Durasi</TableHead>
              <TableHead>Materi</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.student_name}</TableCell>
                <TableCell>
                  <DateText value={r.session_date} tz={timezone} variant="shortDate" />
                </TableCell>
                <TableCell>
                  {r.started_at ? <DateText value={r.started_at} tz={timezone} variant="time" /> : "—"}
                </TableCell>
                <TableCell>
                  <AttendanceBadge status={r.status} />
                </TableCell>
                <TableCell>{r.duration_minutes ? `${r.duration_minutes} mnt` : "—"}</TableCell>
                <TableCell className="max-w-48 truncate">
                  {r.material ?? r.subject_name ?? "—"}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)} aria-label="Edit presensi">
                    <Pencil className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit Presensi</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {editing.student_name} ·{" "}
                <DateText value={editing.session_date} tz={timezone} variant="shortDate" />
              </p>
            </DialogHeader>
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
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                    Batal
                  </Button>
                  <SubmitButton pending={pending} loadingText="Menyimpan...">
                    Simpan
                  </SubmitButton>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

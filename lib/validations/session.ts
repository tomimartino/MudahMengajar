import { z } from "zod";
import { ATTENDANCE_STATUS } from "@/lib/constants";

export const completeSessionSchema = z.object({
  attendance: z.enum(Object.keys(ATTENDANCE_STATUS) as [string, ...string[]], {
    message: "Pilih status kehadiran.",
  }),
  duration_minutes: z.coerce
    .number({ message: "Durasi wajib diisi." })
    .int("Durasi harus bilangan bulat.")
    .positive("Durasi wajib diisi."),
  material: z.string().optional().default(""),
  sub_material: z.string().optional().default(""),
  learning_notes: z.string().optional().default(""),
  homework: z.string().optional().default(""),
  score: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().min(0, "Nilai minimal 0.").max(100, "Nilai maksimal 100.").nullable()
  ),
  progress_notes: z.string().optional().default(""),
});

export const updateSessionSchema = z.object({
  duration_minutes: z.coerce.number().int().positive("Durasi wajib diisi."),
  material: z.string().optional().default(""),
  sub_material: z.string().optional().default(""),
  learning_notes: z.string().optional().default(""),
  homework: z.string().optional().default(""),
  score: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().min(0).max(100).nullable()
  ),
  progress_notes: z.string().optional().default(""),
});

export const updateAttendanceSchema = z.object({
  status: z.enum(Object.keys(ATTENDANCE_STATUS) as [string, ...string[]], {
    message: "Pilih status kehadiran.",
  }),
  note: z.string().optional().default(""),
});

// Isi/edit materi untuk jadwal yang sudah selesai (upsert sesi by schedule)
export const saveSessionForScheduleSchema = z.object({
  material: z.string().optional().default(""),
  sub_material: z.string().optional().default(""),
  homework: z.string().optional().default(""),
  progress_notes: z.string().optional().default(""),
});

export type CompleteSessionInput = z.infer<typeof completeSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type SaveSessionForScheduleInput = z.infer<typeof saveSessionForScheduleSchema>;

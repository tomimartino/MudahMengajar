import { z } from "zod";
import { format, isValid, parseISO } from "date-fns";
import { ATTENDANCE_STATUS } from "@/lib/constants";

const homeworkDueDate = z.preprocess(v => v === "" || v == null ? null : v, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.").refine(v => isValid(parseISO(v)) && format(parseISO(v), "yyyy-MM-dd") === v, "Tanggal tidak valid.").nullable());
export const completeSessionSchema = z.object({
  attendance: z
    .enum(Object.keys(ATTENDANCE_STATUS) as [string, ...string[]], {
      message: "Pilih status kehadiran.",
    })
    .optional()
    .default("hadir"),
  duration_minutes: z.coerce
    .number({ message: "Durasi wajib diisi." })
    .int("Durasi harus bilangan bulat.")
    .positive("Durasi wajib diisi."),
  material: z.string().optional().default(""),
  sub_material: z.string().optional().default(""),
  learning_notes: z.string().optional().default(""),
  homework: z.string().optional().default(""),
  homework_due_date: homeworkDueDate,
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
  homework_due_date: homeworkDueDate,
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
  attendance: z
    .enum(Object.keys(ATTENDANCE_STATUS) as [string, ...string[]], {
      message: "Pilih status kehadiran.",
    })
    .optional(),
  material: z.string().optional().default(""),
  sub_material: z.string().optional().default(""),
  learning_notes: z.string().optional().default(""),
  homework: z.string().optional().default(""),
  homework_due_date: homeworkDueDate,
  score: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().min(0, "Nilai minimal 0.").max(100, "Nilai maksimal 100.").nullable()
  ),
  progress_notes: z.string().optional().default(""),
});

export const switchScheduleSchema = z.object({
  date: z
    .string()
    .min(1, "Tanggal wajib diisi.")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.")
    .refine((value) => {
      const date = parseISO(value);
      return isValid(date) && date.getFullYear() > 0 && format(date, "yyyy-MM-dd") === value;
    }, "Tanggal tidak valid."),
  time: z.string().min(1, "Jam wajib diisi.").regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Jam tidak valid."),
});

export type CompleteSessionInput = z.infer<typeof completeSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type SaveSessionForScheduleInput = z.infer<typeof saveSessionForScheduleSchema>;
export type SwitchScheduleInput = z.infer<typeof switchScheduleSchema>;

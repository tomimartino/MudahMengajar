import { z } from "zod";

const timeString = z.string().regex(/^\d{2}:\d{2}$/, "Format jam HH:mm.");

export const scheduleSchema = z
  .object({
    student_id: z.string().uuid("Pilih siswa."),
    subject_id: z.string().uuid("Pilih mata pelajaran."),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal wajib diisi."),
    start_time: timeString,
    learning_mode: z.enum(["offline", "online", "hybrid"]).optional().nullable(),
    location: z.string().optional().default(""),
    notes: z.string().optional().default(""),
    recurrence: z.enum(["none", "weekly", "biweekly", "custom"]),
    custom_days: z.array(z.number()).optional().default([]),
    until: z.string().optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (v.recurrence === "custom" && (v.custom_days ?? []).length === 0) {
      ctx.addIssue({ code: "custom", path: ["custom_days"], message: "Pilih minimal satu hari." });
    }
    if (v.recurrence !== "none" && !v.until) {
      ctx.addIssue({ code: "custom", path: ["until"], message: "Tanggal akhir pengulangan wajib diisi." });
    }
  });

export type ScheduleInput = z.infer<typeof scheduleSchema>;

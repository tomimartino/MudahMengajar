import { z } from "zod";
import { packageFormSchema } from "@/lib/validations/student";

export const packageEditSchema = packageFormSchema.refine((value) => value.billing_type === "package", {
  path: ["billing_type"], message: "Paket pertemuan harus menggunakan sistem pembayaran paket.",
}).refine((value) => Boolean(value.schedule_start_date), {
  path: ["schedule_start_date"], message: "Tanggal mulai wajib diisi.",
});

export const packageSettingsSchema = z.object({
  learning_mode: z.enum(["offline", "online", "hybrid"]),
  subject_ids: z.array(z.string().uuid()).min(1),
  schedule_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  schedule_times: z.array(z.object({ day: z.number().int().min(1).max(7), start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) })),
  schedule_location: z.string(),
  duration_minutes: z.number().int().min(1).max(1440),
});

export type PackageSettings = z.infer<typeof packageSettingsSchema>;

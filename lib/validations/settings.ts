import { z } from "zod";

export const billingSettingsSchema = z.object({
  default_duration_minutes: z.coerce
    .number()
    .int()
    .min(15, "Minimal 15 menit.")
    .max(600, "Maksimal 600 menit."),
  deduct_package_policy: z.enum(["hadir_only", "include_izin_sakit", "all_except_cancelled"]),
  payment_reminder_days: z.coerce.number().int().min(0).max(30),
  package_low_threshold: z.coerce.number().int().min(1).max(10),
  notify_schedule: z.boolean(),
  notify_payment: z.boolean(),
  notify_package: z.boolean(),
});

export const chatTemplatesSchema = z.object({
  message_template_invoice: z.string().min(1, "Format tagihan wajib diisi."),
  message_template_report: z.string().min(1, "Format laporan belajar wajib diisi."),
});

export type BillingSettingsInput = z.infer<typeof billingSettingsSchema>;
export type ChatTemplatesInput = z.infer<typeof chatTemplatesSchema>;

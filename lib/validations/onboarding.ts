import { z } from "zod";

const phoneRegex = /^(\+62|62|0)8\d{7,12}$/;

export const onboardingSchema = z.object({
  full_name: z.string().min(2, "Nama wajib diisi."),
  whatsapp: z
    .string()
    .refine((v) => v === "" || phoneRegex.test(v), "Nomor WhatsApp tidak valid."),
  subjects: z.array(z.string().min(1)).min(1, "Pilih minimal satu mata pelajaran."),
  teaching_levels: z.array(z.string().min(1)).min(1, "Pilih minimal satu jenjang."),
  business_name: z.string().optional(),
  timezone: z.string().min(1, "Pilih zona waktu."),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

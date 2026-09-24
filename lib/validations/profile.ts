import { z } from "zod";

const phoneRegex = /^(\+62|62|0)8\d{7,12}$/;
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const portfolioSchema = z.object({
  full_name: z.string().min(2, "Nama wajib diisi."),
  whatsapp: z
    .string()
    .refine((v) => v === "" || phoneRegex.test(v), "Nomor WhatsApp tidak valid."),
  timezone: z.string().min(1, "Pilih zona waktu."),
  subjects: z.array(z.string().min(1)).min(1, "Minimal satu mata pelajaran."),
  teaching_levels: z.array(z.string().min(1)).min(1, "Pilih minimal satu jenjang."),
  learning_mode: z.enum(["offline", "online", "hybrid"]),
  slug: z
    .string()
    .optional()
    .default("")
    .refine(
      (v) => v === "" || (v.length >= 3 && v.length <= 30 && slugRegex.test(v)),
      "Link profil 3-30 karakter: huruf kecil, angka, dan tanda hubung."
    )
    .transform((v) => v.toLowerCase()),
  headline: z.string().optional().default(""),
  bio: z.string().optional().default(""),
  rate: z.string().optional().default(""),
  career_start_year: z.string().optional().default(""),
  address: z.string().optional().default(""),
});

export const experienceSchema = z
  .object({
    institution: z.string().min(2, "Nama lembaga wajib diisi."),
    role: z.string().optional().default(""),
    start_year: z.coerce
      .number({ message: "Tahun mulai wajib diisi." })
      .int()
      .min(1950)
      .max(2100),
    end_year: z.string().optional().default(""),
    description: z.string().optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (v.end_year !== "") {
      const end = Number(v.end_year);
      if (!Number.isInteger(end) || end < v.start_year || end > 2100) {
        ctx.addIssue({
          code: "custom",
          path: ["end_year"],
          message: "Tahun selesai harus setelah tahun mulai.",
        });
      }
    }
  });

export const achievementSchema = z.object({
  title: z.string().min(2, "Judul sertifikat wajib diisi."),
  year: z.string().optional().default(""),
  description: z.string().optional().default(""),
});

export type PortfolioInput = z.infer<typeof portfolioSchema>;
export type ExperienceInput = z.infer<typeof experienceSchema>;
export type AchievementInput = z.infer<typeof achievementSchema>;

import { z } from "zod";

export const reviewSchema = z.object({
  rating: z.number().int().min(1, "Pilih rating 1–5.").max(5, "Pilih rating 1–5."),
  comment: z.string().trim().min(10, "Tulis minimal 10 karakter.").max(2000, "Maksimal 2.000 karakter."),
});

export type ReviewInput = z.infer<typeof reviewSchema>;

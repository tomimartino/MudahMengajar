import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Format email tidak valid."),
  password: z.string().min(6, "Kata sandi minimal 6 karakter."),
});

export const registerSchema = z
  .object({
    email: z.string().email("Format email tidak valid."),
    password: z.string().min(6, "Kata sandi minimal 6 karakter."),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi kata sandi tidak sama.",
  });

export const forgotSchema = z.object({
  email: z.string().email("Format email tidak valid."),
});

export const resetSchema = z
  .object({
    password: z.string().min(6, "Kata sandi minimal 6 karakter."),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi kata sandi tidak sama.",
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotInput = z.infer<typeof forgotSchema>;
export type ResetInput = z.infer<typeof resetSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Isi kata sandi saat ini."),
  password: z.string().min(6, "Kata sandi minimal 6 karakter."),
  confirmPassword: z.string(),
  nonce: z.string().trim().max(12).optional(),
}).refine((v) => v.password === v.confirmPassword, {
  path: ["confirmPassword"], message: "Konfirmasi kata sandi tidak sama.",
}).refine((v) => v.password !== v.currentPassword, {
  path: ["password"], message: "Kata sandi baru harus berbeda dari kata sandi saat ini.",
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Isi kata sandi akun."),
  confirmation: z.literal("HAPUS AKUN", { errorMap: () => ({ message: "Ketik HAPUS AKUN untuk mengonfirmasi." }) }),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

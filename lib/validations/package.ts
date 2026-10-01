import { z } from "zod";
import { parseAmount } from "@/lib/utils/currency";

export const packageSchema = z.object({
  student_id: z.string().uuid("Pilih siswa."),
  total_sessions: z.coerce
    .number({ message: "Jumlah pertemuan wajib diisi." })
    .int("Jumlah pertemuan harus bilangan bulat.")
    .positive("Jumlah pertemuan wajib diisi."),
  per_session_rate: z
    .string()
    .refine((v) => parseAmount(v) > 0, "Tarif per pertemuan wajib diisi."),
  price: z.string().optional().default(""),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tenggat bayar wajib diisi."),
});

export type PackageInput = z.infer<typeof packageSchema>;

import { z } from "zod";
import { parseAmount } from "@/lib/utils/currency";

export const packageSchema = z.object({
  student_id: z.string().uuid("Pilih siswa."),
  total_sessions: z.coerce
    .number({ message: "Jumlah pertemuan wajib diisi." })
    .int("Jumlah pertemuan harus bilangan bulat.")
    .positive("Jumlah pertemuan wajib diisi."),
  price: z.string().refine((v) => parseAmount(v) > 0, "Harga paket wajib diisi."),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal mulai wajib diisi."),
});

export type PackageInput = z.infer<typeof packageSchema>;

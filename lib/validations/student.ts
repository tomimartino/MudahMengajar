import { z } from "zod";
import { parseAmount } from "@/lib/utils/currency";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.");
const timeString = z.string().regex(/^\d{2}:\d{2}$/, "Format jam HH:mm.");
const optionalText = z.string().optional().default("");

export const studentSchema = z
  .object({
    full_name: z.string().min(2, "Nama siswa wajib diisi."),
    gender: z.enum(["L", "P"]).optional().nullable(),
    birth_date: z.string().optional().default(""),
    school_name: z.string().optional().default(""),
    school_level: z.enum(["SD", "SMP", "SMA", "Umum"]),
    grade_level: z.string().min(1, "Kelas wajib diisi."),
    phone: z.string().optional().default(""),
    parent_name: z.string().optional().default(""),
    parent_whatsapp: z.string().optional().default(""),
    address: z.string().optional().default(""),
    notes: z.string().optional().default(""),
    learning_mode: z.enum(["offline", "online", "hybrid"]),
    billing_type: z.enum(["per_session", "package", "monthly"]),
    per_session_rate: z.string().optional().default(""),
    monthly_fee: z.string().optional().default(""),
    monthly_due_day: z.string().optional().default(""),
    package_sessions: z.string().optional().default(""),
    package_price: z.string().optional().default(""),
    package_start_date: z.string().optional().default(""),
    subject_ids: z.array(z.string().min(1)).min(1, "Pilih minimal satu mata pelajaran."),
    status: z.enum(["active", "inactive"]),
    // Jadwal (opsional — pilih hari + jam mulai; durasi mengikuti pengaturan)
    schedule_days: z.array(z.number().int().min(1).max(7)).optional().default([]),
    schedule_start_time: optionalText,
    schedule_location: optionalText,
  })
  .superRefine((v, ctx) => {
    if (v.billing_type === "per_session" && parseAmount(v.per_session_rate) <= 0) {
      ctx.addIssue({ code: "custom", path: ["per_session_rate"], message: "Tarif per pertemuan wajib diisi." });
    }
    if (v.billing_type === "monthly") {
      if (parseAmount(v.monthly_fee) <= 0) {
        ctx.addIssue({ code: "custom", path: ["monthly_fee"], message: "Biaya per bulan wajib diisi." });
      }
      const day = Number(v.monthly_due_day);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        ctx.addIssue({ code: "custom", path: ["monthly_due_day"], message: "Tanggal jatuh tempo 1-31." });
      }
    }
    if (v.billing_type === "package") {
      const sessions = Number(v.package_sessions);
      if (!Number.isInteger(sessions) || sessions < 1 || sessions > 200) {
        ctx.addIssue({ code: "custom", path: ["package_sessions"], message: "Jumlah pertemuan wajib diisi (1-200)." });
      }
      if (parseAmount(v.package_price) <= 0) {
        ctx.addIssue({ code: "custom", path: ["package_price"], message: "Harga paket wajib diisi." });
      }
      if (!dateString.safeParse(v.package_start_date).success) {
        ctx.addIssue({ code: "custom", path: ["package_start_date"], message: "Tanggal mulai wajib diisi." });
      }
    }
    // Jadwal opsional: jika salah satu diisi, lengkapi semuanya
    const scheduleFilled =
      (v.schedule_days ?? []).length > 0 || v.schedule_start_time !== "";
    if (scheduleFilled) {
      if ((v.schedule_days ?? []).length === 0) {
        ctx.addIssue({ code: "custom", path: ["schedule_days"], message: "Pilih minimal satu hari." });
      }
      if (!timeString.safeParse(v.schedule_start_time).success) {
        ctx.addIssue({ code: "custom", path: ["schedule_start_time"], message: "Jam mulai wajib diisi." });
      }
    }
  });

export type StudentInput = z.infer<typeof studentSchema>;

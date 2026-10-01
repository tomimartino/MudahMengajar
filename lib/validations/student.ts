import { z } from "zod";
import { parseAmount } from "@/lib/utils/currency";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.");
const timeString = z.string().regex(/^\d{2}:\d{2}$/, "Format jam HH:mm.");
const optionalText = z.string().optional().default("");

type BillingScheduleValues = {
  billing_type: "per_session" | "package" | "monthly";
  per_session_rate: string;
  monthly_fee: string;
  monthly_due_day: string;
  package_sessions: string;
  package_per_session_rate: string;
  schedule_times: { day: number; start_time: string }[];
  schedule_start_date: string;
};

/** Aturan billing per tipe + aturan jadwal — dipakai studentSchema dan packageFormSchema. */
const billingScheduleRefinement: (v: BillingScheduleValues, ctx: z.RefinementCtx) => void = (
  v,
  ctx
) => {
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
    if (parseAmount(v.package_per_session_rate) <= 0) {
      ctx.addIssue({ code: "custom", path: ["package_per_session_rate"], message: "Tarif per pertemuan wajib diisi." });
    }
  }
  // Jadwal opsional; tiap entri hari wajib punya jam mulai valid (diwajibkan schema di atas).
  const seenDays = new Set<number>();
  for (const t of v.schedule_times) {
    if (seenDays.has(t.day)) {
      ctx.addIssue({ code: "custom", path: ["schedule_times"], message: "Hari tidak boleh ganda." });
      break;
    }
    seenDays.add(t.day);
  }
  if (v.schedule_start_date !== "" && !dateString.safeParse(v.schedule_start_date).success) {
    ctx.addIssue({ code: "custom", path: ["schedule_start_date"], message: "Tanggal mulai jadwal tidak valid." });
  }
};

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
    package_per_session_rate: z.string().optional().default(""),
    package_price: z.string().optional().default(""),
    package_start_date: z.string().optional().default(""),
    subject_ids: z.array(z.string().min(1)).min(1, "Pilih minimal satu mata pelajaran."),
    status: z.enum(["active", "inactive"]),
    // Jadwal (opsional — pilih hari, tiap hari bisa punya jam mulai sendiri)
    schedule_times: z
      .array(z.object({ day: z.number().int().min(1).max(7), start_time: timeString }))
      .optional()
      .default([]),
    schedule_location: optionalText,
    schedule_start_date: optionalText,
  })
  .superRefine(billingScheduleRefinement);

export type StudentInput = z.infer<typeof studentSchema>;

/**
 * Form "Tambah Paket" di detail murid: hanya bagian pembelajaran, sistem
 * pembayaran, dan jadwal (identitas siswa diisi server dari database).
 */
export const packageFormSchema = z
  .object({
    learning_mode: z.enum(["offline", "online", "hybrid"]),
    billing_type: z.enum(["per_session", "package", "monthly"]),
    per_session_rate: z.string().optional().default(""),
    monthly_fee: z.string().optional().default(""),
    monthly_due_day: z.string().optional().default(""),
    package_sessions: z.string().optional().default(""),
    package_per_session_rate: z.string().optional().default(""),
    package_price: z.string().optional().default(""),
    package_start_date: z.string().optional().default(""),
    subject_ids: z.array(z.string().min(1)).min(1, "Pilih minimal satu mata pelajaran."),
    status: z.enum(["active", "inactive"]),
    schedule_times: z
      .array(z.object({ day: z.number().int().min(1).max(7), start_time: timeString }))
      .optional()
      .default([]),
    schedule_location: optionalText,
    schedule_start_date: optionalText,
  })
  .superRefine(billingScheduleRefinement);

export type PackageFormInput = z.infer<typeof packageFormSchema>;

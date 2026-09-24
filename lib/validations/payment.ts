import { z } from "zod";
import { parseAmount } from "@/lib/utils/currency";

export const paymentSchema = z.object({
  student_id: z.string().uuid("Pilih siswa."),
  invoice_id: z.string().uuid().optional().nullable(),
  type: z.enum(["package", "monthly", "per_session", "other"]),
  amount: z.string().refine((v) => parseAmount(v) > 0, "Nominal harus lebih dari 0."),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal pembayaran wajib diisi."),
  method: z.enum(["cash", "bank_transfer", "ewallet", "other"]),
  notes: z.string().optional().default(""),
});

export const invoiceSchema = z.object({
  student_id: z.string().uuid("Pilih siswa."),
  type: z.enum(["monthly", "per_session", "other"]),
  period_label: z.string().optional().default(""),
  amount: z.string().refine((v) => parseAmount(v) > 0, "Nominal harus lebih dari 0."),
  due_date: z.string().optional().default(""),
});

export type PaymentInput = z.infer<typeof paymentSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;

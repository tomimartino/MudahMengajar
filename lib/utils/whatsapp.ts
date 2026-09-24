import { formatDate } from "@/lib/utils/date";
import { formatRupiah } from "@/lib/utils/currency";
import { DEFAULT_MESSAGE_TEMPLATES } from "@/lib/constants";
import { renderTemplate } from "@/lib/utils/template";

/** Normalisasi nomor HP Indonesia: "0812..." / "+62812..." → "62812...". */
export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "62" + digits.slice(1);
  if (!digits.startsWith("62")) digits = "62" + digits;
  return digits;
}

/** URL wa.me — pesan dibuka di WhatsApp, pengiriman tetap dikendalikan pengguna. */
export function buildWaLink(phone: string, message: string): string {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}

export interface InvoiceReminder {
  parentName: string;
  studentName: string;
  periodLabel: string;
  amount: number;
  dueDate: string | Date;
}

/** Pesan tagihan memakai template guru (fallback ke template default). */
export function invoiceReminderMessage(
  r: InvoiceReminder,
  tz?: string,
  template?: string | null
): string {
  return renderTemplate(template || DEFAULT_MESSAGE_TEMPLATES.invoice, {
    nama_wali: r.parentName,
    nama_siswa: r.studentName,
    periode: r.periodLabel,
    nominal: formatRupiah(r.amount),
    jatuh_tempo: formatDate(r.dueDate, tz),
  });
}

export interface InvoiceReceipt {
  parentName: string;
  studentName: string;
  periodLabel: string;
  amount: number;
}

/** Pesan bukti pembayaran lunas yang dikirim ke wali. */
export function invoiceReceiptMessage(r: InvoiceReceipt): string {
  return renderTemplate(DEFAULT_MESSAGE_TEMPLATES.receipt, {
    nama_wali: r.parentName,
    nama_siswa: r.studentName,
    periode: r.periodLabel,
    nominal: formatRupiah(r.amount),
  });
}

export interface LearningReport {
  parentName: string;
  studentName: string;
  sessionDate: string | Date;
  material: string;
  score: string | number | null;
  notes: string;
  homework: string;
}

/** Pesan laporan belajar memakai template guru (fallback ke template default). */
export function learningReportMessage(
  r: LearningReport,
  tz?: string,
  template?: string | null
): string {
  return renderTemplate(template || DEFAULT_MESSAGE_TEMPLATES.report, {
    nama_wali: r.parentName,
    nama_siswa: r.studentName,
    tanggal: formatDate(r.sessionDate, tz),
    materi: r.material,
    nilai: r.score ?? "-",
    catatan: r.notes,
    pr: r.homework,
  });
}

import { z } from "zod";
import { switchScheduleSchema } from "@/lib/validations/session";

const id = z.string().uuid("Data tidak valid.");
const text = (min: number, max: number) => z.string().trim().min(min, `Minimal ${min} karakter.`).max(max, `Maksimal ${max} karakter.`);
const optionalNote = (max: number) => z.string().trim().max(max).default("");
const instant = z.string().datetime({ offset: true }).nullable();
export const adminSchemas = {
  account: z.object({ id, status: z.enum(["active","suspended"]), reason: optionalNote(500) }).refine(v => v.status !== "suspended" || v.reason.length >= 5, "Alasan penangguhan wajib diisi."),
  review: z.object({ id, status: z.enum(["new","read","resolved"]), note: optionalNote(2000) }),
  ticket: z.object({ id, status: z.enum(["open","in_progress","resolved"]), priority: z.enum(["low","normal","high"]), reply: optionalNote(4000), internal_note: optionalNote(2000) }),
  member: z.object({ email: z.string().trim().email("Email tidak valid."), role: z.enum(["owner","support"]), active: z.boolean() }),
  settings: z.object({ site_name: text(3,60), support_email: z.union([z.literal(""),z.string().trim().email("Email tidak valid.")]), maintenance_mode: z.boolean() }),
  announcement_save: z.object({ id: id.nullable().default(null), title: text(5,120), body: text(10,4000), target_emails: z.array(z.string().trim().email("Email penerima tidak valid.")).min(1,"Pilih akun tujuan.").max(1000).nullable().default(null), publish_at: instant, expires_at: instant }).refine(v => !v.expires_at || !v.publish_at || new Date(v.expires_at)>new Date(v.publish_at), "Tanggal berakhir harus setelah tanggal publikasi."),
  announcement_publish: z.object({ id }), announcement_cancel: z.object({ id }),
  expense: z.object({ expense_date: switchScheduleSchema.shape.date, category: z.enum(["hosting","domain","tools","other"]), description: text(3,200), amount: z.coerce.number().int().positive("Nominal harus lebih dari nol.").max(999999999999) }),
  expense_archive: z.object({ id }),
} as const;
export type AdminMutation = keyof typeof adminSchemas;
export const supportTicketSchema = z.object({ subject: text(5,120), message: text(10,4000), category: z.enum(["bug","account","suggestion","other"]) });

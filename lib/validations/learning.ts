import { z } from "zod";
import { switchScheduleSchema } from "@/lib/validations/session";
export const learningFileSchema=z.object({name:z.string().min(1).max(255),path:z.string().min(1).max(500),size:z.number().int().positive().max(10485760)});
const base={id:z.string().uuid().nullable().default(null),title:z.string().trim().min(1,"Judul wajib diisi.").max(200),files:z.array(learningFileSchema).max(5,"Maksimal 5 lampiran.").default([])};
export const materialSchema=z.object({...base,content:z.string().trim().max(10000).default(""),source_session_id:z.string().uuid().nullable().default(null)});
export const homeworkSchema=z.object({...base,student_id:z.string().uuid("Pilih murid."),description:z.string().trim().max(10000).default(""),due_date:z.union([z.literal(""),switchScheduleSchema.shape.date]).nullable().transform(v=>v||null),status:z.enum(["assigned","completed"]).default("assigned")});

"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { materialSchema, homeworkSchema } from "@/lib/validations/learning";
import { fail,ok,actionError,type ActionResult } from "@/lib/actions/helpers";
import type { Json } from "@/types/database.types";
import type { LearningFile } from "@/types/learning.types";
export async function saveLearningAction(kind:"material"|"homework",input:unknown):Promise<ActionResult> {
  if(kind!=="material"&&kind!=="homework")return fail("Data tidak valid.");
  const schema=kind==="material"?materialSchema:homeworkSchema;const parsed=schema.safeParse(input);
  if(!parsed.success)return fail(parsed.error.issues[0]?.message??"Input tidak valid.");
  try {
    const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return fail("Silakan masuk kembali.");
    const {id,...rest}=parsed.data;
    const payload={...rest,user_id:user.id,files:rest.files as unknown as Json};
    const query="content" in payload
      ? id?db.from("learning_materials").update(payload).eq("id",id).eq("user_id",user.id):db.from("learning_materials").insert(payload)
      : id?db.from("homework_tasks").update(payload).eq("id",id).eq("user_id",user.id):db.from("homework_tasks").insert(payload);
    const {data,error}=await query.select("id").single();
    if(error||!data)return fail(actionError(new Error(error?.message??"Data tidak ditemukan.")));
    revalidatePath("/","layout");return ok();
  }catch(e){return fail(actionError(e));}
}
export async function setHomeworkStatusAction(id:string,status:"assigned"|"completed"):Promise<ActionResult> {
  if(!/^[\da-f-]{36}$/i.test(id)||!["assigned","completed"].includes(status))return fail("Data tidak valid.");
  const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return fail("Silakan masuk kembali.");
  const {data,error}=await db.from("homework_tasks").update({status}).eq("id",id).eq("user_id",user.id).select("id").single();
  if(error||!data)return fail("Tugas belum dapat diperbarui.");revalidatePath("/","layout");return ok();
}
export async function deleteLearningAction(kind:"material"|"homework",id:string):Promise<ActionResult> {
  if(!["material","homework"].includes(kind)||!/^[\da-f-]{36}$/i.test(id))return fail("Data tidak valid.");
  const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return fail("Silakan masuk kembali.");
  const {data,error}=await db.from(kind==="material"?"learning_materials":"homework_tasks").delete().eq("id",id).eq("user_id",user.id).select("files").single();
  if(error||!data)return fail("Data belum dapat dihapus.");
  const paths=(data.files as unknown as LearningFile[]).map(f=>f.path).filter(p=>p.startsWith(user.id+"/"));
  if(paths.length)await db.storage.from("teaching-files").remove(paths);
  revalidatePath("/","layout");return ok();
}

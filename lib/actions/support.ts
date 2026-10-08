"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supportTicketSchema } from "@/lib/validations/admin";
import { actionError, fail, ok, type ActionResult } from "@/lib/actions/helpers";

export async function createSupportTicketAction(input: unknown): Promise<ActionResult> {
  const parsed = supportTicketSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return fail("Silakan masuk kembali.");
  const { error } = await db.rpc("teacher_support", { p_action: "create", p_data: parsed.data });
  if (error) return fail(actionError(new Error(error.message)));
  revalidatePath("/support");
  return ok();
}

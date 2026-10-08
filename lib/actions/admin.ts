"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminSchemas, type AdminMutation } from "@/lib/validations/admin";
import { actionError, fail, ok, type ActionResult } from "@/lib/actions/helpers";
import type { AdminAccess } from "@/types/admin.types";
import type { Json } from "@/types/database.types";

export async function adminMutationAction(action: AdminMutation, input: unknown): Promise<ActionResult<{ id: string | null }>> {
  const schema = Object.hasOwn(adminSchemas, action) ? adminSchemas[action] : null;
  if (!schema) return fail("Tindakan tidak valid.");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return fail("Silakan masuk kembali.");
    const { data: rawAccess, error: accessError } = await db.rpc("get_admin_access");
    const access = rawAccess as unknown as AdminAccess | null;
    if (accessError || !access?.role || !access.verified) return fail("Akses admin belum terverifikasi.");
    if (!["review","ticket"].includes(action) && access.role !== "owner") return fail("Tindakan ini khusus pemilik website.");
    const { data, error } = await db.rpc("admin_mutate", { p_action: action, p_data: parsed.data as Json });
    if (error) return fail(error.code?.startsWith("23") ? "Input tidak valid. Periksa kembali data Anda." : actionError(new Error(error.message)));
    revalidatePath("/admin","layout");
    revalidatePath("/support");
    if(action==="settings") revalidatePath("/","layout");
    return ok(data as unknown as { id: string | null });
  } catch (error) { return fail(actionError(error)); }
}

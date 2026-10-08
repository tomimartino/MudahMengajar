import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPortalToken, PORTAL_COOKIE } from "@/lib/portal-token";

export async function getPortalAccess(token?: string) {
  const hash = hashPortalToken(
    token ?? (await cookies()).get(PORTAL_COOKIE)?.value ?? "",
  );
  const db = createAdminClient();
  if (!hash || !db) return null;
  const { data: link, error } = await db
    .from("portal_links")
    .select("user_id,student_id")
    .eq("token_hash", hash)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error("Portal belum dapat dimuat. Silakan coba lagi.");
  if (!link) return null;
  const {data:enabled,error:accessError}=await db.rpc("is_account_enabled",{p_user_id:link.user_id});
  if(accessError)throw new Error("Portal belum dapat dimuat. Silakan coba lagi.");
  if(!enabled)return null;
  const { data: student, error: studentError } = await db
    .from("students")
    .select("id,user_id,full_name,school_level,grade_level")
    .eq("id", link.student_id)
    .eq("user_id", link.user_id)
    .is("deleted_at", null)
    .eq("status", "active")
    .maybeSingle();
  if (studentError)
    throw new Error("Portal belum dapat dimuat. Silakan coba lagi.");
  return student ? { db, hash, student } : null;
}

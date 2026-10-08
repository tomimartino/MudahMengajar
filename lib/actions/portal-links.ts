"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actionError, fail, ok } from "@/lib/actions/helpers";
import { createPortalToken, hashPortalToken } from "@/lib/portal-token";
import { getOrigin } from "@/lib/utils/origin";

async function teacher() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Silakan masuk kembali.");
  return { db, user };
}

export async function rotatePortalAction(studentId: string) {
  try {
    z.string().uuid().parse(studentId);
    const { db } = await teacher();
    const token = createPortalToken();
    const { error } = await db.rpc("rotate_portal_link", {
      p_student_id: studentId,
      p_hash: hashPortalToken(token)!,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return ok({ url: `${await getOrigin()}/portal/access/${token}` });
  } catch (error) {
    return fail<{ url: string }>(actionError(error));
  }
}

export async function revokePortalAction(studentId: string) {
  try {
    z.string().uuid().parse(studentId);
    const { db, user } = await teacher();
    const { error } = await db.from("portal_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("student_id", studentId).eq("user_id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return ok();
  } catch (error) {
    return fail(actionError(error));
  }
}

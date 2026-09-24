"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { actionError, fail, ok } from "@/lib/actions/helpers";
import { onboardingSchema } from "@/lib/validations/onboarding";
import type { ActionResult } from "@/lib/actions/helpers";

export async function saveOnboardingAction(input: unknown): Promise<ActionResult> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tidak terautentikasi.");

  try {
    for (const name of parsed.data.subjects) {
      await supabase
        .from("subjects")
        .upsert({ user_id: user.id, name: name.trim() }, { onConflict: "user_id,name" });
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.full_name.trim(),
        whatsapp: parsed.data.whatsapp.trim() || null,
        business_name: parsed.data.business_name?.trim() || null,
        teaching_levels: parsed.data.teaching_levels,
        timezone: parsed.data.timezone,
        onboarding_completed: true,
      })
      .eq("id", user.id);

    if (error) return fail(actionError(error));
  } catch (e) {
    return fail(actionError(e));
  }

  revalidatePath("/", "layout");
  return ok();
}

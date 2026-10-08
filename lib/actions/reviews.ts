"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { actionError, fail, ok, type ActionResult } from "@/lib/actions/helpers";
import { reviewSchema } from "@/lib/validations/review";
import type { AppReview } from "@/types/database.types";

export async function saveReviewAction(input: unknown): Promise<ActionResult<AppReview>> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Review tidak valid.");

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return fail("Sesi berakhir. Silakan masuk kembali.");

    const { data, error } = await supabase.from("app_reviews")
      .upsert({ user_id: user.id, ...parsed.data }, { onConflict: "user_id" })
      .select("*").single();
    if (error) return fail(actionError(error));
    revalidatePath("/settings");
    return ok(data);
  } catch (error) {
    return fail(actionError(error));
  }
}

export async function deleteReviewAction(): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return fail("Sesi berakhir. Silakan masuk kembali.");
    const { error } = await supabase.from("app_reviews").delete().eq("user_id", user.id);
    if (error) return fail(actionError(error));
    revalidatePath("/settings");
    return ok();
  } catch (error) {
    return fail(actionError(error));
  }
}

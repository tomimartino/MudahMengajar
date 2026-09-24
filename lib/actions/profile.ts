"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { actionError, fail, ok } from "@/lib/actions/helpers";
import {
  achievementSchema,
  experienceSchema,
  portfolioSchema,
} from "@/lib/validations/profile";
import { parseAmount } from "@/lib/utils/currency";
import type { ActionResult } from "@/lib/actions/helpers";

export async function updatePortfolioAction(input: unknown): Promise<ActionResult> {
  const parsed = portfolioSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tidak terautentikasi.");

  try {
    // Link profil kustom harus unik di antara guru.
    const slug = d.slug.trim() || null;
    if (slug) {
      const { data: slugOwner } = await supabase
        .from("profiles")
        .select("id")
        .eq("slug", slug)
        .neq("id", user.id)
        .maybeSingle();
      if (slugOwner) return fail("Link profil sudah dipakai guru lain.");
    }

    // Tambahkan mapel baru yang belum ada (mapel lama yang masih dipakai tidak dihapus).
    const { data: existing } = await supabase
      .from("subjects")
      .select("name")
      .eq("user_id", user.id);
    const existingNames = new Set((existing ?? []).map((s) => s.name));
    for (const name of d.subjects) {
      if (!existingNames.has(name.trim())) {
        await supabase
          .from("subjects")
          .upsert({ user_id: user.id, name: name.trim() }, { onConflict: "user_id,name" });
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: d.full_name.trim(),
        whatsapp: d.whatsapp.trim() || null,
        timezone: d.timezone,
        teaching_levels: d.teaching_levels,
        learning_mode: d.learning_mode,
        slug,
        headline: d.headline.trim() || null,
        bio: d.bio.trim() || null,
        rate: parseAmount(d.rate) > 0 ? String(parseAmount(d.rate)) : null,
        career_start_year: d.career_start_year ? Number(d.career_start_year) : null,
        address: d.address.trim() || null,
      })
      .eq("id", user.id);
    if (error) throw error;
  } catch (e) {
    return fail(actionError(e));
  }

  revalidatePath("/", "layout");
  return ok();
}

export async function createExperienceAction(input: unknown): Promise<ActionResult> {
  const parsed = experienceSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tidak terautentikasi.");

  const { error } = await supabase.from("teaching_experiences").insert({
    user_id: user.id,
    institution: d.institution.trim(),
    role: d.role.trim() || null,
    start_year: d.start_year,
    end_year: d.end_year ? Number(d.end_year) : null,
    description: d.description.trim() || null,
  });
  if (error) return fail(actionError(error));

  revalidatePath("/", "layout");
  return ok();
}

export async function updateExperienceAction(
  experienceId: string,
  input: unknown
): Promise<ActionResult> {
  const parsed = experienceSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("teaching_experiences")
    .update({
      institution: d.institution.trim(),
      role: d.role.trim() || null,
      start_year: d.start_year,
      end_year: d.end_year ? Number(d.end_year) : null,
      description: d.description.trim() || null,
    })
    .eq("id", experienceId);
  if (error) return fail(actionError(error));

  revalidatePath("/", "layout");
  return ok();
}

export async function deleteExperienceAction(experienceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("teaching_experiences")
    .delete()
    .eq("id", experienceId);
  if (error) return fail(actionError(error));

  revalidatePath("/", "layout");
  return ok();
}

export async function createAchievementAction(input: unknown): Promise<ActionResult> {
  const parsed = achievementSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tidak terautentikasi.");

  const { error } = await supabase.from("achievements").insert({
    user_id: user.id,
    title: d.title.trim(),
    year: d.year ? Number(d.year) : null,
    description: d.description.trim() || null,
  });
  if (error) return fail(actionError(error));

  revalidatePath("/", "layout");
  return ok();
}

export async function updateAchievementAction(
  achievementId: string,
  input: unknown
): Promise<ActionResult> {
  const parsed = achievementSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("achievements")
    .update({
      title: d.title.trim(),
      year: d.year ? Number(d.year) : null,
      description: d.description.trim() || null,
    })
    .eq("id", achievementId);
  if (error) return fail(actionError(error));

  revalidatePath("/", "layout");
  return ok();
}

export async function deleteAchievementAction(achievementId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("achievements").delete().eq("id", achievementId);
  if (error) return fail(actionError(error));

  revalidatePath("/", "layout");
  return ok();
}

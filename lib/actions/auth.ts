"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rememberActiveAccount, readSavedAccounts, writeSavedAccounts } from "@/lib/auth/account-vault";
import { safeAuthNext } from "@/lib/auth/redirect";
import { hasRecentPasswordRecovery } from "@/lib/auth/password-recovery";
import { actionError, fail, ok } from "@/lib/actions/helpers";
import { getOrigin } from "@/lib/utils/origin";
import {
  forgotSchema,
  loginSchema,
  registerSchema,
  resetSchema,
} from "@/lib/validations/auth";
import type { ActionResult } from "@/lib/actions/helpers";

export async function loginAction(input: unknown): Promise<ActionResult<{ next: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");

  // next harus path internal untuk mencegah open redirect.
  const rawNext =
    input && typeof input === "object" && "next" in input
      ? String((input as Record<string, unknown>).next ?? "")
      : "";
  const next = safeAuthNext(rawNext);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (error.message.toLowerCase().includes("not confirmed")) {
      return fail("Email belum dikonfirmasi. Cek kotak masuk email Anda.");
    }
    return fail("Email atau kata sandi salah.");
  }
  await rememberActiveAccount(supabase);
  return ok({ next });
}

export async function registerAction(input: unknown): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");

  const supabase = await createClient();
  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/email-verified` },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already registered")) {
      return fail("Email sudah terdaftar. Silakan masuk.");
    }
    if (msg.includes("rate limit") || error.status === 429) {
      return fail(
        "Terlalu banyak percobaan pendaftaran. Tunggu sekitar 1 jam, atau nonaktifkan konfirmasi email di Supabase (Authentication → Sign In / Providers → Email)."
      );
    }
    return fail(actionError(error));
  }

  // Konfirmasi email dinonaktifkan → langsung dapat sesi, masuk ke dashboard.
  if (data.session) {
    await rememberActiveAccount(supabase);
    redirect("/dashboard");
  }

  return ok();
}

export async function logoutAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) return fail("Akun belum dapat dikeluarkan. Coba lagi.");
  await writeSavedAccounts((await readSavedAccounts()).filter((entry) => entry.id !== user?.id));
  return ok();
}

export async function forgotPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = forgotSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");

  const supabase = await createClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) return fail(actionError(error));
  return ok();
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Tautan pemulihan sudah berakhir. Minta tautan baru melalui Lupa Kata Sandi.");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !hasRecentPasswordRecovery(claimsData?.claims, user.id)) return fail("Buka tautan pemulihan dari email, atau gunakan Ganti Kata Sandi di Pengaturan.");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(actionError(error));
  await rememberActiveAccount(supabase);
  return ok();
}

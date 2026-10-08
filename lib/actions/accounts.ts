"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createIsolatedAuthClient } from "@/lib/supabase/isolated-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { accountFromSession, readSavedAccounts, rememberActiveAccount, writeSavedAccounts } from "@/lib/auth/account-vault";
import { MAX_SAVED_ACCOUNTS, upsertAccount } from "@/lib/auth/account-vault-codec";
import { changePasswordSchema, deleteAccountSchema, loginSchema } from "@/lib/validations/auth";
import { actionError, fail, ok, type ActionResult } from "@/lib/actions/helpers";
import type { SavedAccountSummary } from "@/types/account.types";
import type { AccountAccess } from "@/types/admin.types";

export async function listSavedAccountsAction(): Promise<ActionResult<SavedAccountSummary[]>> {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    const accounts = await readSavedAccounts();
    const summaries = accounts.map(({ id, email }) => ({ id, email, current: id === user?.id }));
    // Reading a list must not overwrite refresh-token rotations from another tab.
    if (user?.email && !summaries.some((entry) => entry.id === user.id)) summaries.unshift({ id: user.id, email: user.email, current: true });
    return ok(summaries);
  } catch (error) { return fail(actionError(error)); }
}

export async function addAccountAction(input: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return fail("Silakan masuk kembali.");
    const accounts = await rememberActiveAccount(db);
    if (accounts.length >= MAX_SAVED_ACCOUNTS && !accounts.some((entry) => entry.email.toLowerCase() === parsed.data.email.toLowerCase())) {
      return fail("Maksimal 5 akun tersimpan. Hapus salah satu akun terlebih dahulu.");
    }
    const isolated = createIsolatedAuthClient();
    const { data, error } = await isolated.auth.signInWithPassword(parsed.data);
    if (error || !data.session) return fail("Email atau kata sandi salah, atau email belum dikonfirmasi.");
    if (data.user.id === user.id) {
      await isolated.auth.signOut({ scope: "local" });
      return fail("Akun ini sedang digunakan.");
    }
    const next = upsertAccount(accounts, accountFromSession(data.session));
    await writeSavedAccounts(next);
    const { error: setError } = await db.auth.setSession(data.session);
    if (setError) return fail("Akun tersimpan, tetapi belum dapat dibuka. Coba pindah akun kembali.");
    // No signOut: both accounts must remain signed in.
    return ok();
  } catch (error) { return fail(actionError(error)); }
}

export async function switchAccountAction(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) return fail("Akun tidak valid.");
  try {
    const db = await createClient();
    const accounts = await rememberActiveAccount(db);
    const selected = accounts.find((entry) => entry.id === id);
    if (!selected) return fail("Akun belum tersimpan di browser ini.");
    const { data: { user } } = await db.auth.getUser();
    if (user?.id === id) return ok();
    const isolated = createIsolatedAuthClient();
    const { data, error } = await isolated.auth.refreshSession({ refresh_token: selected.refreshToken });
    if (error || !data.session || data.user?.id !== id) {
      if (error && [400, 401, 403, 404].includes(error.status ?? 0)) {
        await writeSavedAccounts(accounts.filter((entry) => entry.id !== id));
        return fail("Sesi akun sudah berakhir. Tambahkan akun ini kembali dengan email dan kata sandi.");
      }
      return fail("Akun belum dapat dibuka. Coba lagi sebentar.");
    }
    // Save the rotated refresh token even if writing the active session fails.
    await writeSavedAccounts(upsertAccount(accounts, accountFromSession(data.session)));
    const { error: setError } = await db.auth.setSession(data.session);
    if (setError) return fail("Sesi belum dapat diganti. Coba lagi.");
    return ok();
  } catch (error) { return fail(actionError(error)); }
}

export async function removeSavedAccountAction(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) return fail("Akun tidak valid.");
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (user?.id === id) return fail("Gunakan Keluar dari Akun untuk akun yang sedang aktif.");
    const accounts = await readSavedAccounts();
    const selected = accounts.find((entry) => entry.id === id);
    if (!selected) return fail("Akun belum tersimpan di browser ini.");
    const isolated = createIsolatedAuthClient();
    const { data: refreshed, error: refreshError } = await isolated.auth.refreshSession({ refresh_token: selected.refreshToken });
    if (refreshError && ![400, 401, 403, 404].includes(refreshError.status ?? 0)) return fail("Sesi belum dapat dikeluarkan. Coba lagi.");
    if (!refreshError) {
      if (!refreshed.session || refreshed.user?.id !== id) return fail("Sesi akun tidak sesuai.");
      await writeSavedAccounts(upsertAccount(accounts, accountFromSession(refreshed.session)));
      const { error } = await isolated.auth.signOut({ scope: "local" });
      if (error) return fail("Sesi belum dapat dikeluarkan. Coba lagi.");
    }
    await writeSavedAccounts(accounts.filter((entry) => entry.id !== id));
    return ok();
  } catch (error) { return fail(actionError(error)); }
}

export async function changePasswordAction(input: unknown): Promise<ActionResult<{ needsVerification?: boolean }>> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  const isolated = createIsolatedAuthClient();
  try {
    const db = await createClient();
    const { data: { user }, error: userError } = await db.auth.getUser();
    if (userError || !user?.email) return fail("Silakan masuk kembali.");
    if (user.factors?.some((factor) => factor.status === "verified")) {
      const { data: assurance, error: assuranceError } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError || assurance?.currentLevel !== "aal2") return fail("Selesaikan verifikasi dua langkah sebelum mengganti kata sandi.");
    }
    const { data, error } = await isolated.auth.signInWithPassword({ email: user.email, password: parsed.data.currentPassword });
    if (error || data.user?.id !== user.id) return fail("Kata sandi saat ini salah.");
    const { error: updateError } = await db.auth.updateUser({ password: parsed.data.password,
      current_password: parsed.data.currentPassword, ...(parsed.data.nonce ? { nonce: parsed.data.nonce } : {}) });
    if (updateError) {
      if (updateError.code === "reauthentication_needed" || updateError.code === "reauthentication_not_valid") {
        return { ok: false, error: "Masukkan kode verifikasi yang dikirim ke email Anda.", data: { needsVerification: true } };
      }
      return fail(updateError.code === "same_password" ? "Kata sandi baru harus berbeda." : actionError(updateError));
    }
    // Password changes can revoke saved sessions belonging to this account elsewhere.
    await rememberActiveAccount(db);
    return ok();
  } catch (error) { return fail(actionError(error)); }
  finally { await isolated.auth.signOut({ scope: "local" }); }
}

export async function sendPasswordVerificationAction(): Promise<ActionResult> {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return fail("Silakan masuk kembali.");
  const { error } = await db.auth.reauthenticate();
  return error ? fail("Kode belum dapat dikirim. Coba lagi sebentar.") : ok();
}

export async function deleteOwnAccountAction(input: unknown): Promise<ActionResult> {
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Konfirmasi belum lengkap.");
  const isolated = createIsolatedAuthClient();
  try {
    const db = await createClient();
    const { data: { user }, error: userError } = await db.auth.getUser();
    if (userError || !user?.email) return fail("Silakan masuk kembali.");
    const { data: rawAccess, error: accessError } = await db.rpc("get_account_access");
    const access = rawAccess as unknown as AccountAccess | null;
    if (accessError || !access || access.status !== "active") return fail("Akses akun belum dapat diverifikasi.");
    if (access.role) return fail("Akun admin harus melepas akses admin terlebih dahulu melalui pemilik website.");
    const { data, error } = await isolated.auth.signInWithPassword({ email: user.email, password: parsed.data.password });
    if (error || data.user?.id !== user.id) return fail("Kata sandi salah. Akun belum dihapus.");
    const { data: assurance, error: assuranceError } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || (assurance?.nextLevel === "aal2" && assurance.currentLevel !== "aal2")) return fail("Verifikasi dua langkah diperlukan sebelum menghapus akun.");
    const admin = createAdminClient();
    if (!admin) return fail("Penghapusan akun belum tersedia. Hubungi pemilik website.");
    // Only paths owned by this authenticated account; never accept an id/path from input.
    for (const bucket of ["avatars", "teaching-files"]) {
      const { data: bucketData, error: bucketError } = await admin.storage.getBucket(bucket);
      if (bucketError) {
        if (["404", "400"].includes(String(bucketError.statusCode)) && /not found/i.test(bucketError.message)) continue;
        return fail("File akun belum dapat diperiksa. Akun belum dihapus.");
      }
      if (!bucketData) continue;
      const paths: string[] = [];
      async function collect(prefix: string) {
        for (let offset = 0; ; offset += 100) {
          const { data: files, error } = await admin!.storage.from(bucket).list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
          if (error) throw new Error("File akun belum dapat diperiksa. Akun belum dihapus.");
          for (const file of files ?? []) {
            const path = `${prefix}/${file.name}`;
            if (!path.startsWith(`${user!.id}/`)) throw new Error("Lokasi file tidak valid.");
            if (file.id) paths.push(path); else await collect(path);
          }
          if (!files || files.length < 100) break;
        }
      }
      await collect(user.id);
      for (let start = 0; start < paths.length; start += 100) {
        const { error } = await admin.storage.from(bucket).remove(paths.slice(start, start + 100));
        if (error) return fail("Sebagian file belum dapat dihapus. Coba kembali untuk menyelesaikan penghapusan akun.");
      }
    }
    const { data: latestAccess, error: latestError } = await db.rpc("get_account_access");
    if (latestError || (latestAccess as unknown as AccountAccess | null)?.role || (latestAccess as unknown as AccountAccess | null)?.status !== "active") return fail("Akses akun berubah. Penghapusan dibatalkan.");
    const { data: { session } } = await db.auth.getSession();
    if (!session) return fail("Silakan masuk kembali.");
    const { error: revokeError } = await admin.auth.admin.signOut(session.access_token, "global");
    if (revokeError) return fail("Sesi akun belum dapat dinonaktifkan. Coba kembali.");
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) return fail("Akun belum dapat dihapus. Silakan masuk kembali untuk mencoba ulang.");
    await db.auth.signOut({ scope: "local" });
    await writeSavedAccounts((await readSavedAccounts()).filter((entry) => entry.id !== user.id));
    return ok();
  } catch (error) { return fail(actionError(error)); }
  finally { await isolated.auth.signOut({ scope: "local" }); }
}

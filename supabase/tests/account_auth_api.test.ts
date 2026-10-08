// Opt-in real provider checks using disposable accounts only.
// npx vitest run --config supabase/tests/integration.config.mts account_auth_api
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
vi.mock("server-only", () => ({}));
const runtime = vi.hoisted(() => ({ client: null as SupabaseClient<Database> | null, cookies: new Map<string, string>() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => runtime.client! }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => runtime.cookies.has(name) ? { value: runtime.cookies.get(name) } : undefined,
  set: (name: string, value: string) => { if (value) runtime.cookies.set(name, value); else runtime.cookies.delete(name); } }) }));
import { addAccountAction, changePasswordAction, deleteOwnAccountAction, listSavedAccountsAction, removeSavedAccountAction, switchAccountAction } from "@/lib/actions/accounts";
import { logoutAction, resetPasswordAction } from "@/lib/actions/auth";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((line) => /^[\w]+=/.test(line)).map((line) => {
  const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")];
}));
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options);
const active = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
const accounts = Array.from({ length: 2 }, () => ({ email: `qa-accounts-${randomUUID()}@example.invalid`, password: randomBytes(28).toString("base64url"), id: "" }));
const newPassword = randomBytes(28).toString("base64url");

async function must<R extends { data: unknown; error: { code?: string; status?: number } | null }>(request: PromiseLike<R>): Promise<NonNullable<R["data"]>> {
  const result = await request;
  if (result.error) throw new Error(`Account integration failed (${result.error.code ?? result.error.status ?? "unknown"})`);
  if (result.data == null) throw new Error("Account integration returned no data");
  return result.data as NonNullable<R["data"]>;
}

beforeAll(async () => {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  for (const account of accounts) {
    const created = await must(service.auth.admin.createUser({ email: account.email, password: account.password, email_confirm: true, user_metadata: { full_name: "Uji Akun Sementara" } }));
    account.id = created.user!.id;
    await must(service.from("profiles").update({ onboarding_completed: true, timezone: "Asia/Jakarta" }).eq("id", account.id).select("id"));
  }
  await must(active.auth.signInWithPassword(accounts[0]));
  runtime.client = active;
});
afterAll(async () => {
  await active.auth.signOut({ scope: "local" });
  for (const account of accounts) if (account.id) {
    for (const bucket of ["avatars", "teaching-files"]) await service.storage.from(bucket).remove([`${account.id}/qa-account-file.txt`]);
    const { error } = await service.auth.admin.deleteUser(account.id);
    if (error && error.status !== 404) throw new Error(`Fixture cleanup failed (${error.status})`);
  }
  runtime.cookies.clear(); vi.unstubAllEnvs();
});

describe("real password change and account switching", () => {
  it("retains both sessions, switches repeatedly, and isolates failed additions", async () => {
    expect((await listSavedAccountsAction()).data?.map((account) => account.id)).toEqual([accounts[0].id]);
    expect((await addAccountAction({ email: accounts[1].email, password: "wrong-password" })).ok).toBe(false);
    expect((await must(active.auth.getUser())).user!.id).toBe(accounts[0].id);
    expect((await addAccountAction(accounts[1])).ok).toBe(true);
    expect((await must(active.auth.getUser())).user!.id).toBe(accounts[1].id);
    expect((await listSavedAccountsAction()).data).toHaveLength(2);
    expect((await switchAccountAction(randomUUID())).ok).toBe(false);
    for (const account of [accounts[0], accounts[1], accounts[0], accounts[1]]) {
      expect((await switchAccountAction(account.id)).ok).toBe(true);
      expect((await must(active.auth.getUser())).user!.id).toBe(account.id);
    }
  });
  it("rejects an incorrect old password, changes the correct account, and signs out locally", async () => {
    expect((await changePasswordAction({ currentPassword: "wrong-password", password: newPassword, confirmPassword: newPassword })).ok).toBe(false);
    const changed = await changePasswordAction({ currentPassword: accounts[1].password, password: newPassword, confirmPassword: newPassword });
    expect(changed).toMatchObject({ ok: true });
    const check = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
    expect((await check.auth.signInWithPassword(accounts[1])).error).toBeTruthy();
    expect((await must(check.auth.signInWithPassword({ email: accounts[1].email, password: newPassword }))).user!.id).toBe(accounts[1].id);
    await check.auth.signOut({ scope: "local" });
    accounts[1].password = newPassword;
    expect((await logoutAction()).ok).toBe(true);
    expect((await listSavedAccountsAction()).data?.map((account) => account.id)).toEqual([accounts[0].id]);
    expect((await switchAccountAction(accounts[0].id)).ok).toBe(true);
    expect((await must(active.auth.getUser())).user!.id).toBe(accounts[0].id);
  });
  it("removes a saved session without deleting the underlying account", async () => {
    expect((await addAccountAction(accounts[1])).ok).toBe(true);
    expect((await removeSavedAccountAction(accounts[0].id)).ok).toBe(true);
    expect((await listSavedAccountsAction()).data?.map((account) => account.id)).toEqual([accounts[1].id]);
    expect((await must(service.auth.admin.getUserById(accounts[0].id))).user!.id).toBe(accounts[0].id);
  });
  it("permits password reset through a recovery session and rejects a normal login session", async () => {
    const target = accounts[1];
    const password = randomBytes(28).toString("base64url");
    expect((await resetPasswordAction({ password, confirmPassword: password })).ok).toBe(false);
    const link = await must(service.auth.admin.generateLink({ type: "recovery", email: target.email }));
    const recovery = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
    const verified = await must(recovery.auth.verifyOtp({ type: "recovery", token_hash: link.properties!.hashed_token }));
    await must(active.auth.setSession(verified.session!));
    const reset = await resetPasswordAction({ password, confirmPassword: password });
    expect(reset).toMatchObject({ ok: true });
    target.password = password;
  });
  it("deletes only its authenticated fixture, files and records, and denies stale-token uploads", async () => {
    const target = accounts[1];
    const { student } = await must(active.from("students").insert({ user_id: target.id, full_name: "Murid Uji Penghapusan", school_level: "SD", grade_level: "4", billing_type: "package" }).select().single().then((result) => ({ ...result, data: result.data ? { student: result.data } : null })));
    await must(active.storage.from("teaching-files").upload(`${target.id}/qa-account-file.txt`, "test", { contentType: "text/plain" }));
    const { session } = await must(active.auth.getSession());
    expect(session).toBeTruthy();
    const stale = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { ...options, global: { headers: { Authorization: `Bearer ${session!.access_token}` } } });
    expect((await deleteOwnAccountAction({ password: "wrong-password", confirmation: "HAPUS AKUN" })).ok).toBe(false);
    const deleted = await deleteOwnAccountAction({ password: target.password, confirmation: "HAPUS AKUN", userId: accounts[0].id });
    expect(deleted).toMatchObject({ ok: true });
    expect((await service.auth.admin.getUserById(target.id)).error).toBeTruthy();
    expect((await must(service.auth.admin.getUserById(accounts[0].id))).user!.id).toBe(accounts[0].id);
    expect(await must(service.from("students").select("id").eq("id", student.id))).toEqual([]);
    expect(await must(service.storage.from("teaching-files").list(target.id))).toEqual([]);
    expect((await stale.storage.from("teaching-files").upload(`${target.id}/qa-account-file.txt`, "after-delete", { contentType: "text/plain" })).error).toBeTruthy();
    expect((await listSavedAccountsAction()).data).toEqual([]);
  });
});

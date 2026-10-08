import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { decodeAccounts, encodeAccounts, upsertAccount } from "@/lib/auth/account-vault-codec";
import { safeAuthNext } from "@/lib/auth/redirect";
import { changePasswordSchema, deleteAccountSchema } from "@/lib/validations/auth";
import { hasRecentPasswordRecovery } from "@/lib/auth/password-recovery";

const account = { id: "11111111-1111-4111-8111-111111111111", email: "guru@example.com", refreshToken: "private-refresh-token" };
describe("saved account vault", () => {
  beforeEach(() => { vi.stubEnv("ACCOUNT_SESSION_SECRET", "test-secret-that-is-never-a-real-credential"); });
  afterEach(() => vi.unstubAllEnvs());
  it("encrypts tokens and identity, and rejects ciphertext changes", () => {
    const encoded = encodeAccounts([account]);
    expect(encoded).not.toContain(account.email);
    expect(Buffer.from(encoded, "base64url").toString("utf8")).not.toContain(account.refreshToken);
    expect(decodeAccounts(encoded)).toEqual([account]);
    const bytes = Buffer.from(encoded, "base64url"); bytes[bytes.length - 1] ^= 1;
    expect(decodeAccounts(bytes.toString("base64url"))).toEqual([]);
    expect(decodeAccounts("untrusted-cookie")).toEqual([]);
  });
  it("rejects expired sessions and cookies encrypted for a different project/key", () => {
    const encoded = encodeAccounts([account], 0);
    expect(decodeAccounts(encoded, 100 * 24 * 60 * 60 * 1000)).toEqual([]);
    const valid = encodeAccounts([account]);
    vi.stubEnv("ACCOUNT_SESSION_SECRET", "another-server-secret");
    expect(decodeAccounts(valid)).toEqual([]);
  });
  it("updates the rotated token without dropping another account and bounds cookie size", () => {
    const accounts = Array.from({ length: 5 }, (_, i) => ({ ...account, id: `11111111-1111-4111-8111-11111111111${i}` }));
    const updated = upsertAccount(accounts, { ...accounts[2], refreshToken: "rotated-token" });
    expect(updated).toHaveLength(5);
    expect(updated[0].refreshToken).toBe("rotated-token");
    expect(updated.map((entry) => entry.id).sort()).toEqual(accounts.map((entry) => entry.id).sort());
    expect(() => upsertAccount(accounts, { ...account, id: "22222222-2222-4222-8222-222222222222" })).toThrow("Maksimal 5");
    expect(encodeAccounts(accounts).length).toBeLessThan(3800);
  });
});
describe("sensitive account input", () => {
  it("requires the current password, matching confirmation, and a different new password", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "", password: "new12345", confirmPassword: "new12345" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: "old12345", password: "new12345", confirmPassword: "wrong12345" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: "old12345", password: "old12345", confirmPassword: "old12345" }).success).toBe(false);
  });
  it("requires explicit deletion confirmation and strips any supplied user id", () => {
    expect(deleteAccountSchema.safeParse({ password: "old12345", confirmation: "" }).success).toBe(false);
    expect(deleteAccountSchema.parse({ password: "old12345", confirmation: "HAPUS AKUN", userId: account.id })).toEqual({ password: "old12345", confirmation: "HAPUS AKUN" });
  });
  it("keeps callback/login redirects on this website", () => {
    for (const path of ["https://evil.test", "//evil.test", "/\\evil.test", "/\n/evil.test"]) expect(safeAuthNext(path)).toBe("/dashboard");
    expect(safeAuthNext("/reset-password")).toBe("/reset-password");
    expect(safeAuthNext("/students?status=active")).toBe("/students?status=active");
  });
  it("accepts only a recent verified recovery session belonging to the same account", () => {
    const now = Date.now();
    const claims = { sub: account.id, amr: [{ method: "recovery", timestamp: now / 1000 - 120 }] };
    expect(hasRecentPasswordRecovery(claims, account.id, now)).toBe(true);
    expect(hasRecentPasswordRecovery({ ...claims, amr: [{ method: "otp", timestamp: now / 1000 }] }, account.id, now)).toBe(true);
    expect(hasRecentPasswordRecovery({ ...claims, amr: [{ method: "password", timestamp: now / 1000 }] }, account.id, now)).toBe(false);
    expect(hasRecentPasswordRecovery(claims, "different-account", now)).toBe(false);
    expect(hasRecentPasswordRecovery(claims, account.id, now + 3600000)).toBe(false);
  });
});

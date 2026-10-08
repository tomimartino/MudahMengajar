import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({ getUser: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), signIn: vi.fn(), rpc: vi.fn(), remember: vi.fn(), getSession: vi.fn(), read: vi.fn(), write: vi.fn(), refresh: vi.fn(), setSession: vi.fn(), admin: vi.fn(), assurance: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mock.getUser, updateUser: mock.updateUser, getSession: mock.getSession, setSession: mock.setSession, signOut: mock.signOut, mfa: { getAuthenticatorAssuranceLevel: mock.assurance } }, rpc: mock.rpc }) }));
vi.mock("@/lib/supabase/isolated-auth", () => ({ createIsolatedAuthClient: () => ({ auth: { signInWithPassword: mock.signIn, signOut: mock.signOut, refreshSession: mock.refresh } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mock.admin }));
vi.mock("@/lib/auth/account-vault", () => ({ rememberActiveAccount: mock.remember, readSavedAccounts: mock.read, writeSavedAccounts: mock.write, accountFromSession: (session: { user: { id: string; email: string }; refresh_token: string }) => ({ id: session.user.id, email: session.user.email, refreshToken: session.refresh_token }) }));
import { addAccountAction, changePasswordAction, deleteOwnAccountAction, switchAccountAction } from "@/lib/actions/accounts";
import { logoutAction } from "@/lib/actions/auth";

const id = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const user = { id, email: "a@example.com" };
beforeEach(() => {
  vi.resetAllMocks();
  mock.getUser.mockResolvedValue({ data: { user } });
  mock.signOut.mockResolvedValue({ error: null });
  mock.remember.mockResolvedValue([{ id, email: user.email, refreshToken: "a-refresh" }]);
  mock.read.mockResolvedValue([{ id, email: user.email, refreshToken: "a-refresh" }, { id: otherId, email: "b@example.com", refreshToken: "b-refresh" }]);
  mock.write.mockResolvedValue(undefined);
});
describe("account action boundaries", () => {
  it("checks the old password before changing credentials", async () => {
    mock.signIn.mockResolvedValue({ data: { user: null }, error: { code: "invalid_credentials" } });
    const result = await changePasswordAction({ currentPassword: "wrong123", password: "newpass123", confirmPassword: "newpass123" });
    expect(result.ok).toBe(false); expect(mock.updateUser).not.toHaveBeenCalled();
    expect(mock.signIn).toHaveBeenCalledWith({ email: user.email, password: "wrong123" });
  });
  it("requires existing MFA verification before a password change", async () => {
    mock.getUser.mockResolvedValue({ data: { user: { ...user, factors: [{ status: "verified" }] } } });
    mock.assurance.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
    expect((await changePasswordAction({ currentPassword: "oldpass123", password: "newpass123", confirmPassword: "newpass123" })).ok).toBe(false);
    expect(mock.updateUser).not.toHaveBeenCalled(); expect(mock.signIn).not.toHaveBeenCalled();
  });
  it("requires a live session and rejects a different verification identity", async () => {
    mock.signIn.mockResolvedValue({ data: { user: { id: otherId } }, error: null });
    expect((await changePasswordAction({ currentPassword: "oldpass123", password: "newpass123", confirmPassword: "newpass123" })).ok).toBe(false);
    expect(mock.updateUser).not.toHaveBeenCalled();
    mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await deleteOwnAccountAction({ password: "oldpass123", confirmation: "HAPUS AKUN" })).ok).toBe(false);
    expect(mock.admin).not.toHaveBeenCalled();
  });
  it("refuses admin deletion and fails closed when account access cannot be checked", async () => {
    mock.rpc.mockResolvedValue({ data: { role: "owner", status: "active" }, error: null });
    expect((await deleteOwnAccountAction({ password: "oldpass123", confirmation: "HAPUS AKUN" })).ok).toBe(false);
    mock.rpc.mockResolvedValue({ data: null, error: { code: "unavailable" } });
    expect((await deleteOwnAccountAction({ password: "oldpass123", confirmation: "HAPUS AKUN" })).ok).toBe(false);
    expect(mock.admin).not.toHaveBeenCalled(); expect(mock.signIn).not.toHaveBeenCalled();
  });
  it("does not replace the active session when adding an account fails", async () => {
    mock.signIn.mockResolvedValue({ data: { session: null }, error: { code: "invalid_credentials" } });
    expect((await addAccountAction({ email: "b@example.com", password: "wrong123" })).ok).toBe(false);
    expect(mock.setSession).not.toHaveBeenCalled();
  });
  it("accepts only accounts authenticated by the encrypted saved vault", async () => {
    expect((await switchAccountAction(otherId)).ok).toBe(false);
    expect(mock.refresh).not.toHaveBeenCalled(); expect(mock.setSession).not.toHaveBeenCalled();
  });
  it("keeps a saved account after temporary provider errors", async () => {
    mock.remember.mockResolvedValue(await mock.read());
    mock.refresh.mockResolvedValue({ data: { session: null }, error: { status: 503 } });
    expect((await switchAccountAction(otherId)).ok).toBe(false);
    expect(mock.write).not.toHaveBeenCalled();
  });
  it("signs out only the current session and preserves the other account", async () => {
    expect((await logoutAction()).ok).toBe(true);
    expect(mock.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mock.write).toHaveBeenCalledWith([{ id: otherId, email: "b@example.com", refreshToken: "b-refresh" }]);
  });
});

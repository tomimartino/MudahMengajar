import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";

export const ACCOUNT_COOKIE = "mm-saved-accounts-v1";
export const MAX_SAVED_ACCOUNTS = 5;
export const ACCOUNT_COOKIE_AGE = 90 * 24 * 60 * 60;
const accountSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().max(254),
  refreshToken: z.string().min(1).max(512),
});
const vaultSchema = z.object({
  version: z.literal(1),
  expiresAt: z.number().finite(),
  accounts: z.array(accountSchema).max(MAX_SAVED_ACCOUNTS),
});
export type SavedAccount = z.infer<typeof accountSchema>;

function vaultKey() {
  const secret = process.env.ACCOUNT_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Penyimpanan sesi akun belum dikonfigurasi.");
  // A separate key/context from the provider credential. Never expose this to the browser.
  return createHash("sha256").update(`${ACCOUNT_COOKIE}:${process.env.NEXT_PUBLIC_SUPABASE_URL}:${secret}`).digest();
}

export function encodeAccounts(accounts: SavedAccount[], now = Date.now()): string {
  const payload = vaultSchema.parse({ version: 1, expiresAt: now + ACCOUNT_COOKIE_AGE * 1000, accounts });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKey(), iv);
  cipher.setAAD(Buffer.from(ACCOUNT_COOKIE));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const encoded = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
  if (encoded.length > 3800) throw new Error("Penyimpanan akun penuh. Hapus salah satu akun tersimpan.");
  return encoded;
}

export function decodeAccounts(value?: string, now = Date.now()): SavedAccount[] {
  if (!value || value.length > 3800) return [];
  try {
    const bytes = Buffer.from(value, "base64url");
    if (bytes.length < 29) return [];
    const decipher = createDecipheriv("aes-256-gcm", vaultKey(), bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(ACCOUNT_COOKIE));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const json = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
    const vault = vaultSchema.parse(JSON.parse(json));
    if (vault.expiresAt <= now) return [];
    return [...new Map(vault.accounts.map((account) => [account.id, account])).values()];
  } catch {
    // Modified, expired, or encrypted with an old configuration: require sign-in again.
    return [];
  }
}

export function upsertAccount(accounts: SavedAccount[], account: SavedAccount): SavedAccount[] {
  const others = accounts.filter((entry) => entry.id !== account.id);
  if (others.length >= MAX_SAVED_ACCOUNTS) throw new Error("Maksimal 5 akun tersimpan. Hapus salah satu akun terlebih dahulu.");
  return [account, ...others];
}

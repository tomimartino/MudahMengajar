import { createHash, randomBytes } from "node:crypto";

export const PORTAL_COOKIE = "mm_parent_portal";
export function createPortalToken() {
  return randomBytes(32).toString("base64url");
}
export function hashPortalToken(token: string): string | null {
  return /^[A-Za-z0-9_-]{43}$/.test(token)
    ? createHash("sha256").update(token).digest("hex")
    : null;
}

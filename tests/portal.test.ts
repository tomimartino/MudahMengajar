import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createPortalToken, hashPortalToken } from "@/lib/portal-token";

describe("private parent portal credentials", () => {
  it("uses unpredictable tokens and one-way digests", () => {
    const a = createPortalToken();
    const b = createPortalToken();
    expect(a).not.toBe(b);
    expect(a).toHaveLength(43);
    expect(hashPortalToken(a)).toBe(createHash("sha256").update(a).digest("hex"));
    expect(hashPortalToken(a)).not.toContain(a);
  });
  it("rejects malformed bearer credentials", () => {
    for (const token of ["", "d26632eb-60eb-4c8f-91e7-586149f632b4", "a".repeat(500), "../".repeat(15)]) {
      expect(hashPortalToken(token)).toBeNull();
    }
  });
});

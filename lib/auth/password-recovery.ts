import { z } from "zod";
const recoveryClaimsSchema = z.object({
  sub: z.string(),
  amr: z.array(z.object({ method: z.string(), timestamp: z.number() })),
});

/** This receives verified getClaims() data, never a decoded/unverified browser JWT. */
export function hasRecentPasswordRecovery(claims: unknown, userId: string, now = Date.now()) {
  const parsed = recoveryClaimsSchema.safeParse(claims);
  if (!parsed.success || parsed.data.sub !== userId) return false;
  const seconds = now / 1000;
  // The hosted provider also issues recovery sessions with method "otp".
  // A recent verified one-time sign-in proves control of the recovery channel.
  return parsed.data.amr.some((entry) => ["recovery", "otp"].includes(entry.method) && entry.timestamp <= seconds + 30 && entry.timestamp > seconds - 3600);
}

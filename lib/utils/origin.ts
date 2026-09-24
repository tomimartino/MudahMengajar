import "server-only";
import { headers } from "next/headers";

/**
 * Origin aktif (mis. https://mudahmengajar.vercel.app atau http://localhost:3000)
 * dari header request, fallback ke NEXT_PUBLIC_APP_URL. Dipakai untuk link
 * share profil dan redirect email auth agar tidak selalu mengarah ke localhost.
 */
export async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? "http";
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

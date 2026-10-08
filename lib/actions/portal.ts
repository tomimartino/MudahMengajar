"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PORTAL_COOKIE } from "@/lib/portal-token";

export async function exitPortalAction() {
  (await cookies()).set(PORTAL_COOKIE, "", {
    path: "/portal",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
  });
  redirect("/portal");
}

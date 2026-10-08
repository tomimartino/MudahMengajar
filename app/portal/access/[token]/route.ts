import { NextResponse, type NextRequest } from "next/server";
import { getPortalAccess } from "@/lib/portal";
import { PORTAL_COOKIE } from "@/lib/portal-token";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const access = await getPortalAccess(token);
  // Keep the request's browser origin; Next's internal URL may be normalized to localhost.
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: access ? "/portal" : "/portal?expired=1" },
  });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  if (access)
    response.cookies.set(PORTAL_COOKIE, token, {
      httpOnly: true,
      secure:
        request.headers.get("x-forwarded-proto") === "https" ||
        request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/portal",
      maxAge: 30 * 24 * 60 * 60,
    });
  else response.cookies.set(PORTAL_COOKIE, "", { path: "/portal", maxAge: 0 });
  return response;
}

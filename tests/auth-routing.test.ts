import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({ user: { id: "11111111-1111-4111-8111-111111111111" } as { id: string } | null, callback: false }));
vi.mock("@supabase/ssr", () => ({ createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (cookies: { name: string; value: string; options: { path: string } }[], headers: Record<string, string>) => void } }) => ({
  auth: {
    getUser: async () => { options.cookies.setAll([{ name: "qa-session", value: "refreshed", options: { path: "/" } }], { "Cache-Control": "private, no-store" }); return { data: { user: mock.user } }; },
    exchangeCodeForSession: async () => { mock.callback = true; options.cookies.setAll([{ name: "qa-session", value: "recovered", options: { path: "/" } }], { "Cache-Control": "private, no-store" }); return { error: null }; },
  },
  rpc: async () => ({ data: { role: null, status: "active", maintenance: false }, error: null }),
}) }));
import { updateSession } from "@/lib/supabase/proxy";
import { GET } from "@/app/auth/callback/route";

beforeEach(() => { mock.user = { id: "11111111-1111-4111-8111-111111111111" }; mock.callback = false; });
describe("password recovery routing", () => {
  it("keeps logged-in users on password recovery pages", async () => {
    for (const path of ["/reset-password", "/forgot-password"]) {
      const response = await updateSession(new NextRequest(`https://app.example${path}`));
      expect(response.status).toBe(200);
      expect(response.cookies.get("qa-session")?.value).toBe("refreshed");
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    }
  });
  it("preserves refreshed cookies in login redirects", async () => {
    const response = await updateSession(new NextRequest("https://app.example/login"));
    expect(response.headers.get("location")).toBe("https://app.example/dashboard");
    expect(response.cookies.get("qa-session")?.value).toBe("refreshed");
  });
  it("requires a login for private pages", async () => {
    mock.user = null;
    const response = await updateSession(new NextRequest("https://app.example/settings"));
    expect(response.headers.get("location")).toBe("https://app.example/login?next=%2Fsettings");
  });
  it("writes exchanged recovery cookies onto the response the browser receives", async () => {
    const response = await GET(new NextRequest("https://app.example/auth/callback?code=qa-code&next=/reset-password"));
    expect(mock.callback).toBe(true);
    expect(response.headers.get("location")).toBe("https://app.example/reset-password");
    expect(response.cookies.get("qa-session")?.value).toBe("recovered");
  });
  it("rejects a callback redirect to another host", async () => {
    const response = await GET(new NextRequest("https://app.example/auth/callback?code=qa-code&next=//evil.example"));
    expect(response.headers.get("location")).toBe("https://app.example/dashboard");
  });
});

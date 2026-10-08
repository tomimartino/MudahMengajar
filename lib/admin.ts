import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AdminAccess, AdminDataMap, AdminSection, SiteConfig } from "@/types/admin.types";

export const getAdminContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, access: { role: null, verified: false } as AdminAccess };
  const { data, error } = await supabase.rpc("get_admin_access");
  if (error) throw new Error("Akses admin belum dapat diperiksa.");
  return { supabase, user, access: data as unknown as AdminAccess };
});

export async function readAdminData<S extends AdminSection>(section: S, filters: { q?: string; status?: string; page?: number } = {}): Promise<AdminDataMap[S]> {
  const { supabase, access } = await getAdminContext();
  if (!access.role || !access.verified) throw new Error("Akses admin belum terverifikasi.");
  const { data, error } = await supabase.rpc("admin_read", {
    p_section: section, p_search: filters.q ?? "", p_status: filters.status ?? "all", p_page: filters.page ?? 1,
  });
  if (error) throw new Error("Data admin belum dapat dimuat. Silakan coba lagi.");
  return data as unknown as AdminDataMap[S];
}

export const getSiteConfig = cache(async (): Promise<SiteConfig> => {
  const db = await createClient();
  const { data, error } = await db.rpc("get_site_config");
  if (error || !data) return { site_name: "MudahMengajar", support_email: "", maintenance_mode: false };
  return data as unknown as SiteConfig;
});

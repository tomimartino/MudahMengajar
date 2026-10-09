import { redirect } from "next/navigation";
import { createClient, getCurrentUser, getCurrentProfile, getAccountAccess } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import type { AccountAccess } from "@/types/admin.types";
import { PushRegister } from "@/components/notifications/push-register";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [{data:rawAccess,error:accessError}, { data: profile }, { count: unreadCount }] = await Promise.all([
    getAccountAccess(),
    getCurrentProfile(user.id),
    supabase.from("notifications").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).is("read_at", null),
  ]);
  const access=rawAccess as unknown as AccountAccess|null;
  if(accessError||!access||access.status==="suspended")redirect("/account-suspended");
  if(access.maintenance&&!access.role)redirect("/maintenance");
  if (!profile || !profile.onboarding_completed) redirect("/onboarding");

  return (
    <AppShell
      key={user.id}
      userName={profile.full_name}
      userEmail={user.email ?? ""}
      userAvatarUrl={profile.avatar_url}
      timezone={profile.timezone}
      unreadCount={unreadCount ?? 0}
      isAdmin={Boolean(access.role)}
    >
      <PushRegister />
      {children}
    </AppShell>
  );
}

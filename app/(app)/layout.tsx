import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { PushRegister } from "@/components/notifications/push-register";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, timezone, onboarding_completed, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.onboarding_completed) redirect("/onboarding");

  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  return (
    <AppShell
      userName={profile.full_name}
      userEmail={user.email ?? ""}
      userAvatarUrl={profile.avatar_url}
      timezone={profile.timezone}
      unreadCount={unreadCount ?? 0}
    >
      <PushRegister />
      {children}
    </AppShell>
  );
}

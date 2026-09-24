import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export const metadata = { title: "Perkenalan Singkat" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, whatsapp, business_name, timezone, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (profile?.onboarding_completed) redirect("/dashboard");

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <OnboardingForm
          initialFullName={profile?.full_name ?? ""}
          initialWhatsapp={profile?.whatsapp ?? ""}
          initialBusinessName={profile?.business_name ?? ""}
          initialTimezone={profile?.timezone ?? "Asia/Jakarta"}
        />
      </div>
    </div>
  );
}

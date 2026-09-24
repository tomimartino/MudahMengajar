import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { BillingSettingsForm } from "@/components/settings/billing-settings-form";
import { ChatTemplatesForm } from "@/components/settings/chat-templates-form";
import { LogoutButton } from "@/components/settings/logout-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: settings } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user!.id)
    .single();

  return (
    <div>
      <PageHeader
        title="Pengaturan"
        description="Atur format chat, kebijakan paket, dan akun. Profil & portofolio ada di halaman Profil."
      />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Format Chat ke Orang Tua</CardTitle>
          </CardHeader>
          <CardContent>
            {settings && (
              <ChatTemplatesForm
                initial={{
                  invoice: settings.message_template_invoice,
                  report: settings.message_template_report,
                }}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pembayaran & Kebijakan Paket</CardTitle>
          </CardHeader>
          <CardContent>
            {settings && (
              <BillingSettingsForm
                initial={{
                  default_duration_minutes: settings.default_duration_minutes,
                  deduct_package_policy: settings.deduct_package_policy,
                  payment_reminder_days: settings.payment_reminder_days,
                  package_low_threshold: settings.package_low_threshold,
                  notify_schedule: settings.notify_schedule,
                  notify_payment: settings.notify_payment,
                  notify_package: settings.notify_package,
                }}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Akun</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{user!.email}</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/forgot-password">
                  <KeyRound className="size-4" /> Ganti Kata Sandi
                </Link>
              </Button>
            </div>
            <div className="border-t pt-4">
              <LogoutButton />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

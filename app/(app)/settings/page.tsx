import type { Metadata } from "next";
import { createClient, getCurrentUser, getCurrentSettings, getAccountAccess } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { BillingSettingsForm } from "@/components/settings/billing-settings-form";
import { ChatTemplatesForm } from "@/components/settings/chat-templates-form";
import { LogoutButton } from "@/components/settings/logout-button";
import { PushSettings } from "@/components/settings/push-settings";
import { ThemeSettings } from "@/components/settings/theme-settings";
import { ReviewForm } from "@/components/settings/review-form";
import { AccountSwitcher } from "@/components/settings/account-switcher";
import { ChangePasswordDialog } from "@/components/settings/change-password-dialog";
import { DeleteAccountDialog } from "@/components/settings/delete-account-dialog";
import type { AccountAccess } from "@/types/admin.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const [{ data: settings }, { data: review, error: reviewError }, { data: accountAccess }] = await Promise.all([
    getCurrentSettings(user!.id),
    supabase.from("app_reviews").select("*").eq("user_id", user!.id).maybeSingle(),
    getAccountAccess(),
  ]);

  return (
    <div>
      <PageHeader
        title="Pengaturan"
      />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tema Tampilan</CardTitle>
          </CardHeader>
          <CardContent>
            <ThemeSettings />
          </CardContent>
        </Card>

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
                  notify_material: settings.notify_material,
                }}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notifikasi Push</CardTitle>
          </CardHeader>
          <CardContent>
            <PushSettings />
          </CardContent>
        </Card>

        <Card id="review" className="scroll-mt-24">
          <CardHeader>
            <CardTitle className="text-base">Review MudahMengajar</CardTitle>
          </CardHeader>
          <CardContent>
            <ReviewForm initial={review} loadError={Boolean(reviewError)} />
          </CardContent>
        </Card>

        <Card id="akun" className="scroll-mt-24">
          <CardHeader>
            <CardTitle className="text-base">Akun</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{user!.email}</p>
              </div>
              <ChangePasswordDialog />
            </div>
            <div className="border-t pt-4"><AccountSwitcher /></div>
            <div className="border-t pt-4">
              <LogoutButton />
            </div>
            <div className="border-t pt-4"><DeleteAccountDialog email={user!.email ?? ""} isAdmin={Boolean((accountAccess as unknown as AccountAccess | null)?.role)} /></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

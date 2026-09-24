"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { updateBillingSettingsAction } from "@/lib/actions/settings";
import {
  billingSettingsSchema,
  type BillingSettingsInput,
} from "@/lib/validations/settings";
import { DEDUCT_POLICIES } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SubmitButton } from "@/components/shared/submit-button";

export function BillingSettingsForm({
  initial,
}: {
  initial: {
    default_duration_minutes: number;
    deduct_package_policy: string;
    payment_reminder_days: number;
    package_low_threshold: number;
    notify_schedule: boolean;
    notify_payment: boolean;
    notify_package: boolean;
  };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const form = useForm<BillingSettingsInput>({
    resolver: zodResolver(billingSettingsSchema) as unknown as Resolver<BillingSettingsInput>,
    defaultValues: {
      default_duration_minutes: initial.default_duration_minutes,
      deduct_package_policy: initial.deduct_package_policy as
        | "hadir_only"
        | "include_izin_sakit"
        | "all_except_cancelled",
      payment_reminder_days: initial.payment_reminder_days,
      package_low_threshold: initial.package_low_threshold,
      notify_schedule: initial.notify_schedule,
      notify_payment: initial.notify_payment,
      notify_package: initial.notify_package,
    },
  });

  async function onSubmit(values: BillingSettingsInput) {
    setPending(true);
    const result = await updateBillingSettingsAction(values);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Pengaturan disimpan.");
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <p className="text-sm font-medium">Pembelajaran</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="default_duration_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Durasi default (menit)</FormLabel>
                  <FormControl>
                    <Input type="number" inputMode="numeric" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="space-y-4 border-t pt-4">
          <div>
            <p className="text-sm font-medium">Kebijakan Paket</p>
            <p className="text-xs text-muted-foreground">
              Kapan paket pertemuan dikurangi saat pertemuan selesai.
            </p>
          </div>
          <FormField
            control={form.control}
            name="deduct_package_policy"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kurangi paket jika kehadiran:</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(DEDUCT_POLICIES).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="package_low_threshold"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ingatkan saat sisa paket ≤ (pertemuan)</FormLabel>
                <FormControl>
                  <Input type="number" inputMode="numeric" className="w-24" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4 border-t pt-4">
          <div>
            <p className="text-sm font-medium">Pembayaran</p>
            <p className="text-xs text-muted-foreground">
              Berapa hari sebelum jatuh tempo pengingat muncul.
            </p>
          </div>
          <FormField
            control={form.control}
            name="payment_reminder_days"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ingatkan H- (hari)</FormLabel>
                <FormControl>
                  <Input type="number" inputMode="numeric" className="w-24" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-medium">Notifikasi dalam aplikasi</p>
          <FormField
            control={form.control}
            name="notify_schedule"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between">
                <div>
                  <FormLabel>Pengingat jadwal</FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Jadwal hari ini dan jadwal berikutnya.
                  </p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notify_payment"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between">
                <div>
                  <FormLabel>Pengingat pembayaran</FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Tagihan jatuh tempo dan terlambat.
                  </p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notify_package"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between">
                <div>
                  <FormLabel>Pengingat paket</FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Paket siswa hampir habis.
                  </p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end">
          <SubmitButton pending={pending} loadingText="Menyimpan...">
            Simpan Pengaturan
          </SubmitButton>
        </div>
      </form>
    </Form>
  );
}

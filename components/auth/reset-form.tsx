"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { resetPasswordAction } from "@/lib/actions/auth";
import { resetSchema, type ResetInput } from "@/lib/validations/auth";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { SubmitButton } from "@/components/shared/submit-button";

export function ResetForm() {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const form = useForm<ResetInput>({
    resolver: zodResolver(resetSchema) as unknown as Resolver<ResetInput>,
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetInput) {
    setPending(true);
    const result = await resetPasswordAction(values);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Kata sandi berhasil diubah.");
    router.push("/login");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-bold">Kata sandi baru</h1>
        <p className="text-sm text-muted-foreground">
          Buat kata sandi baru untuk akunmu.
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kata sandi baru</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Minimal 6 karakter" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ulangi kata sandi</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <SubmitButton pending={pending} className="w-full" loadingText="Menyimpan...">
            Simpan kata sandi
          </SubmitButton>
        </form>
      </Form>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Kembali ke halaman masuk
        </Link>
      </p>
    </div>
  );
}

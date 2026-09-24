"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { forgotPasswordAction } from "@/lib/actions/auth";
import { forgotSchema, type ForgotInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
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

export function ForgotForm() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const form = useForm<ForgotInput>({
    resolver: zodResolver(forgotSchema) as unknown as Resolver<ForgotInput>,
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotInput) {
    setPending(true);
    const result = await forgotPasswordAction(values);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-bold">Cek email Anda</h1>
        <p className="text-sm text-muted-foreground">
          Jika email terdaftar, kami telah mengirim link untuk mengatur ulang kata sandi.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Kembali ke halaman masuk</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-bold">Lupa kata sandi</h1>
        <p className="text-sm text-muted-foreground">
          Masukkan email akunmu, kami kirim link reset.
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="nama@email.com" autoComplete="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <SubmitButton pending={pending} className="w-full" loadingText="Mengirim...">
            Kirim link reset
          </SubmitButton>
        </form>
      </Form>
      <p className="text-center text-sm text-muted-foreground">
        Ingat kata sandinya?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Masuk
        </Link>
      </p>
    </div>
  );
}

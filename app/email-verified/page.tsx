import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Email Terverifikasi" };

export default async function EmailVerifiedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="mb-6 flex justify-center">
        <Logo />
      </div>
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100">
            <BadgeCheck className="size-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold">Email berhasil diverifikasi</h1>
          <p className="text-sm text-muted-foreground">
            Akun Anda sudah aktif. Silakan lanjut untuk melengkapi data mengajar Anda.
          </p>
          <Button asChild className="mt-2 w-full">
            <Link href={user ? "/dashboard" : "/login"}>
              {user ? "Lanjut ke Dashboard" : "Masuk ke Aplikasi"}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

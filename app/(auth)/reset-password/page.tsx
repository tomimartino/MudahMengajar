import type { Metadata } from "next";
import { ResetForm } from "@/components/auth/reset-form";

export const metadata: Metadata = { title: "Kata Sandi Baru" };

export default function ResetPasswordPage() {
  return <ResetForm />;
}

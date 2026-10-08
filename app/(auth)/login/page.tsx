import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; deleted?: string }>;
}) {
  const { next, deleted } = await searchParams;
  return <div className="space-y-5">{deleted === "1" && <p role="status" className="rounded-xl bg-muted p-3 text-sm">Akun berhasil dihapus.</p>}<LoginForm next={next} /></div>;
}

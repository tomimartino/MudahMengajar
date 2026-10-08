"use client";

import { useId, useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { changePasswordAction, sendPasswordVerificationAction } from "@/lib/actions/accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [error, setError] = useState<string>();
  const id = useId();
  async function sendCode() {
    setPending(true);
    try {
      const result = await sendPasswordVerificationAction();
      if (result.ok) toast.success("Kode verifikasi dikirim ke email Anda."); else toast.error(result.error);
    } catch { toast.error("Kode belum dapat dikirim."); }
    finally { setPending(false); }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setPending(true); setError(undefined);
    try {
      const result = await changePasswordAction({ currentPassword: values.get("currentPassword"), password: values.get("password"), confirmPassword: values.get("confirmPassword"), ...(needsVerification ? { nonce: values.get("nonce") } : {}) });
      if (!result.ok) {
        setError(result.error);
        if (result.data?.needsVerification && !needsVerification) {
          setNeedsVerification(true);
          const sent = await sendPasswordVerificationAction();
          if (!sent.ok) toast.error(sent.error);
        }
        return;
      }
      toast.success("Kata sandi berhasil diubah.");
      setOpen(false); setNeedsVerification(false);
    } catch { setError("Kata sandi belum dapat diubah. Coba lagi."); }
    finally { setPending(false); }
  }
  return <Dialog open={open} onOpenChange={(next) => { if (!pending) { setOpen(next); setError(undefined); setNeedsVerification(false); } }}>
    <DialogTrigger asChild><Button variant="outline" size="sm"><KeyRound className="size-4" />Ganti Kata Sandi</Button></DialogTrigger>
    <DialogContent showCloseButton={!pending}>
      <DialogHeader><DialogTitle>Ganti Kata Sandi</DialogTitle><DialogDescription className="sr-only">Isi kata sandi saat ini dan kata sandi baru.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><Label htmlFor={`${id}-current`}>Kata sandi saat ini</Label><Input id={`${id}-current`} name="currentPassword" type="password" autoComplete="current-password" required disabled={pending} /></div>
        <div className="space-y-2"><Label htmlFor={`${id}-new`}>Kata sandi baru</Label><Input id={`${id}-new`} name="password" type="password" autoComplete="new-password" required minLength={6} disabled={pending} /></div>
        <div className="space-y-2"><Label htmlFor={`${id}-confirm`}>Ulangi kata sandi baru</Label><Input id={`${id}-confirm`} name="confirmPassword" type="password" autoComplete="new-password" required minLength={6} disabled={pending} /></div>
        {needsVerification && <div className="space-y-2"><Label htmlFor={`${id}-nonce`}>Kode verifikasi email</Label><Input id={`${id}-nonce`} name="nonce" autoComplete="one-time-code" inputMode="numeric" maxLength={12} required disabled={pending} /><Button type="button" variant="link" size="sm" disabled={pending} onClick={() => void sendCode()}>Kirim ulang kode</Button></div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>{pending ? "Menyimpan..." : "Simpan Kata Sandi"}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}

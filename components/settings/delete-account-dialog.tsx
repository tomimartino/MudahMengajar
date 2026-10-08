"use client";

import { useId, useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteOwnAccountAction } from "@/lib/actions/accounts";
import { navigateAfterAccountChange } from "@/lib/auth/account-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function DeleteAccountDialog({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string>();
  const id = useId();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setPending(true); setError(undefined);
    try {
      const result = await deleteOwnAccountAction({ password: values.get("password"), confirmation });
      if (!result.ok) { setError(result.error); return; }
      await navigateAfterAccountChange("/login?deleted=1");
    } catch { setError("Penghapusan belum dapat diselesaikan. Coba lagi."); }
    finally { setPending(false); }
  }
  return <div className="space-y-2">
    <Dialog open={open} onOpenChange={(next) => { if (!pending) { setOpen(next); setError(undefined); setConfirmation(""); } }}>
      <DialogTrigger asChild><Button variant="outline" className="text-destructive hover:text-destructive" disabled={isAdmin}><Trash2 className="size-4" />Hapus Akun</Button></DialogTrigger>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader><DialogTitle>Hapus Akun Permanen</DialogTitle><DialogDescription>Data murid, jadwal, pembayaran, materi, dan file milik akun {email} akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2"><Label htmlFor={`${id}-password`}>Kata sandi akun</Label><Input id={`${id}-password`} name="password" type="password" autoComplete="current-password" required disabled={pending} /></div>
          <div className="space-y-2"><Label htmlFor={`${id}-confirm`}>Ketik HAPUS AKUN</Label><Input id={`${id}-confirm`} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" required disabled={pending} /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Batal</Button><Button type="submit" variant="destructive" disabled={pending || confirmation !== "HAPUS AKUN"}>{pending ? "Menghapus..." : "Hapus Akun Permanen"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
    {isAdmin && <p className="text-xs text-muted-foreground">Lepas akses admin melalui pemilik website sebelum menghapus akun ini.</p>}
  </div>;
}

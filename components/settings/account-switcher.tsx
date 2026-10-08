"use client";

import { useEffect, useState, useId } from "react";
import { ArrowRightLeft, Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { addAccountAction, listSavedAccountsAction, removeSavedAccountAction, switchAccountAction } from "@/lib/actions/accounts";
import { navigateAfterAccountChange } from "@/lib/auth/account-navigation";
import type { SavedAccountSummary } from "@/types/account.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function AccountSwitcher({ showAdd = true }: { showAdd?: boolean }) {
  const [accounts, setAccounts] = useState<SavedAccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [addOpen, setAddOpen] = useState(false);
  const id = useId();

  async function reload() {
    setLoading(true);
    try {
      const result = await listSavedAccountsAction();
      if (!result.ok) { setError(result.error); return; }
      setError(undefined);
      setAccounts(result.data ?? []);
    } catch { setError("Daftar akun belum dapat dimuat."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let mounted = true;
    void listSavedAccountsAction().then((result) => {
      if (!mounted) return;
      if (result.ok) setAccounts(result.data ?? []); else setError(result.error);
    }).catch(() => { if (mounted) setError("Daftar akun belum dapat dimuat."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  async function switchTo(accountId: string) {
    setBusy(accountId);
    try {
      const result = await switchAccountAction(accountId);
      if (!result.ok) { toast.error(result.error); await reload(); return; }
      await navigateAfterAccountChange();
    } catch { toast.error("Akun belum dapat diganti. Coba lagi."); }
    finally { setBusy(undefined); }
  }
  async function remove(accountId: string) {
    setBusy(accountId);
    try {
      const result = await removeSavedAccountAction(accountId);
      if (!result.ok) { toast.error(result.error); return; }
      setAccounts((previous) => previous.filter((account) => account.id !== accountId));
      toast.success("Akun dikeluarkan dari browser ini.");
    } catch { toast.error("Akun belum dapat dikeluarkan."); }
    finally { setBusy(undefined); }
  }
  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy("add");
    try {
      const result = await addAccountAction({ email: values.get("email"), password: values.get("password") });
      if (!result.ok) { toast.error(result.error); return; }
      await navigateAfterAccountChange();
    } catch { toast.error("Akun belum dapat ditambahkan. Coba lagi."); }
    finally { setBusy(undefined); }
  }

  if (!showAdd && !loading && !error && accounts.length === 0) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">{showAdd ? "Pindah Akun" : "Akun Tersimpan"}</p>
        {showAdd && <Dialog open={addOpen} onOpenChange={(open) => { if (!busy) setAddOpen(open); }}>
          <DialogTrigger asChild><Button variant="outline" size="sm" disabled={loading || Boolean(busy)}><Plus className="size-4" />Tambah Akun</Button></DialogTrigger>
          <DialogContent showCloseButton={!busy}>
            <DialogHeader><DialogTitle>Tambah Akun</DialogTitle><DialogDescription>Akun sebelumnya tetap login di browser ini.</DialogDescription></DialogHeader>
            <form onSubmit={add} className="space-y-4">
              <div className="space-y-2"><Label htmlFor={`${id}-email`}>Email</Label><Input id={`${id}-email`} name="email" type="email" autoComplete="username" required maxLength={254} disabled={Boolean(busy)} /></div>
              <div className="space-y-2"><Label htmlFor={`${id}-password`}>Kata sandi</Label><Input id={`${id}-password`} name="password" type="password" autoComplete="current-password" required minLength={6} disabled={Boolean(busy)} /></div>
              <Button type="submit" className="w-full" disabled={Boolean(busy)}>{busy ? "Memeriksa..." : "Masuk & Pindah Akun"}</Button>
            </form>
          </DialogContent>
        </Dialog>}
      </div>
      {loading ? <p className="text-sm text-muted-foreground" role="status">Memuat akun...</p> : error ? <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" onClick={() => void reload()}>Coba Lagi</Button></div> : <div className="space-y-2">
        {accounts.map((account) => <div key={account.id} className="flex items-center gap-2 rounded-xl border p-3">
          <div className="min-w-0 flex-1"><p className="break-all text-sm font-medium">{account.email}</p>{account.current && <p className="mt-1 flex items-center gap-1 text-xs text-primary"><Check className="size-3" />Sedang digunakan</p>}</div>
          {!account.current && <><Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => void switchTo(account.id)} aria-label={`Pindah ke ${account.email}`}><ArrowRightLeft className="size-4" /><span className="hidden sm:inline">{busy === account.id ? "Memproses..." : "Pindah"}</span></Button><Button variant="ghost" size="icon-sm" disabled={Boolean(busy)} onClick={() => void remove(account.id)} aria-label={`Keluarkan ${account.email} dari browser ini`} title="Keluarkan dari browser ini"><X className="size-4" /></Button></>}
        </div>)}
      </div>}
    </div>
  );
}

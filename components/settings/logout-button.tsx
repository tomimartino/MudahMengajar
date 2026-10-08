"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { navigateAfterAccountChange } from "@/lib/auth/account-navigation";

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  async function logout() {
    setPending(true);
    try {
      const result = await logoutAction();
      if (!result.ok) { toast.error(result.error); return; }
      await navigateAfterAccountChange("/login");
    } catch { toast.error("Akun belum dapat dikeluarkan."); }
    finally { setPending(false); }
  }
  return (
    <Button variant="outline" disabled={pending} onClick={() => void logout()}>
      <LogOut className="size-4" /> {pending ? "Keluar..." : "Keluar dari Akun"}
    </Button>
  );
}

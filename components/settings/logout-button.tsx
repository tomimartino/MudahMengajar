"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <Button variant="outline" onClick={() => void logoutAction()}>
      <LogOut className="size-4" /> Keluar dari Akun
    </Button>
  );
}

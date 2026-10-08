"use client";
import { useEffect } from "react";
import { ACCOUNT_CHANGE_KEY } from "@/lib/auth/account-navigation";
import { createClient } from "@/lib/supabase/client";

export function AccountSessionSync() {
  useEffect(() => {
    const db = createClient();
    function sync(event: StorageEvent) {
      if (event.key !== ACCOUNT_CHANGE_KEY) return;
      void db.auth.stopAutoRefresh().finally(() => window.location.reload());
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return null;
}

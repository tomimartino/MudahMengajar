"use client";
import { createClient } from "@/lib/supabase/client";

export const ACCOUNT_CHANGE_KEY = "mm-account-change-v1";

export async function navigateAfterAccountChange(path = "/dashboard") {
  await createClient().auth.stopAutoRefresh();
  try {
    // A non-secret signal makes other tabs discard the previous account's UI/cache.
    localStorage.setItem(ACCOUNT_CHANGE_KEY, crypto.randomUUID());
  } catch { /* Navigation still works when browser storage is unavailable. */ }
  window.location.assign(path);
}

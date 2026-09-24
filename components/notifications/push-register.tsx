"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/utils/push";

/** Registrasi service worker diam-diam saat aplikasi dibuka (tanpa meminta izin). */
export function PushRegister() {
  useEffect(() => {
    void registerServiceWorker();
  }, []);

  return null;
}

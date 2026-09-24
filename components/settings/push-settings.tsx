"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BellOff, BellRing } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  arrayBufferToBase64,
  getVapidPublicKey,
  isIOSDevice,
  registerServiceWorker,
} from "@/lib/utils/push";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/badges";

type PushStatus = "unsupported" | "subscribed" | "granted" | "denied" | "default";

export function PushSettings() {
  const [supported] = useState(
    () => "serviceWorker" in navigator && "PushManager" in window
  );
  const [status, setStatus] = useState<PushStatus>("default");
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    if (!supported) {
      setStatus("unsupported");
      return;
    }
    const reg = await registerServiceWorker();
    if (!reg) {
      setStatus("unsupported");
      return;
    }
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      setStatus("subscribed");
    } else if (Notification.permission === "denied") {
      setStatus("denied");
    } else if (Notification.permission === "granted") {
      setStatus("granted");
    } else {
      setStatus("default");
    }
  }, [supported]);

  useEffect(() => {
    // Status subscription hanya bisa dibaca asinkron setelah mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function enable() {
    setPending(true);
    try {
      if (!supported) {
        toast.error("Browser ini tidak mendukung notifikasi push.");
        return;
      }
      if (
        isIOSDevice() &&
        !window.matchMedia("(display-mode: standalone)").matches
      ) {
        toast.warning(
          "Di iPhone, pasang aplikasi ke layar utama dulu (Bagikan → Tambah ke Layar Utama), lalu buka dari ikonnya."
        );
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        toast.error("Izin notifikasi ditolak. Aktifkan lewat pengaturan browser.");
        return;
      }
      const reg = await registerServiceWorker();
      if (!reg) throw new Error("Service worker tidak tersedia.");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: getVapidPublicKey(),
      });

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi berakhir. Silakan masuk kembali.");

      const p256dh = sub.getKey("p256dh");
      const auth = sub.getKey("auth");
      if (!p256dh || !auth) throw new Error("Subscription tidak valid.");
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: sub.endpoint,
          p256dh: arrayBufferToBase64(p256dh),
          auth: arrayBufferToBase64(auth),
        },
        { onConflict: "endpoint" }
      );
      if (error) throw error;

      setStatus("subscribed");
      toast.success("Notifikasi push aktif di perangkat ini.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Gagal mengaktifkan notifikasi push."
      );
    } finally {
      setPending(false);
    }
  }

  async function disable() {
    setPending(true);
    try {
      const reg = await registerServiceWorker();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        const supabase = createClient();
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", sub.endpoint);
      }
      setStatus(
        Notification.permission === "denied" ? "denied" : "default"
      );
      toast.success("Notifikasi push dinonaktifkan di perangkat ini.");
    } catch {
      toast.error("Gagal menonaktifkan notifikasi push.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="max-w-md space-y-1">
        <p className="text-sm font-medium">Notifikasi di HP</p>
        <p className="text-xs text-muted-foreground">
          Terima notifikasi jadwal hari ini, pembayaran jatuh tempo, dan paket
          hampir habis langsung di HP — bahkan saat aplikasi tidak dibuka. Di
          iPhone, pasang aplikasi ke layar utama terlebih dahulu.
        </p>
        <div className="pt-1">
          {status === "subscribed" && <StatusBadge tone="green">Aktif di perangkat ini</StatusBadge>}
          {status === "granted" && <StatusBadge tone="yellow">Izin diberikan, belum berlangganan</StatusBadge>}
          {status === "denied" && <StatusBadge tone="red">Ditolak — ubah izin di pengaturan browser</StatusBadge>}
          {status === "unsupported" && <StatusBadge tone="gray">Browser tidak mendukung push</StatusBadge>}
          {status === "default" && <StatusBadge tone="gray">Belum diaktifkan</StatusBadge>}
        </div>
      </div>
      {status === "subscribed" ? (
        <Button variant="outline" size="sm" onClick={() => void disable()} disabled={pending}>
          <BellOff className="size-4" /> Nonaktifkan
        </Button>
      ) : (
        <Button size="sm" onClick={() => void enable()} disabled={pending || !supported}>
          <BellRing className="size-4" /> {pending ? "Memproses..." : "Aktifkan Notifikasi"}
        </Button>
      )}
    </div>
  );
}

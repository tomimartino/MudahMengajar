/** Konversi kunci VAPID base64url (dari env) menjadi Uint8Array untuk pushManager.subscribe. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

/** Kunci publik VAPID dari env untuk enkripsi subscription. */
export function getVapidPublicKey(): Uint8Array<ArrayBuffer> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) {
    throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY belum diatur di .env.local.");
  }
  return urlBase64ToUint8Array(key);
}

/** Registrasi service worker tanpa meminta izin notifikasi. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

/** Deteksi iPhone/iPad (web push iOS hanya jalan pada PWA terpasang). */
export function isIOSDevice(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** SubKey ArrayBuffer → string base64 (format penyimpanan di tabel push_subscriptions). */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

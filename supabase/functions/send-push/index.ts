// Edge Function "send-push" — dikirim notifikasi Web Push ke perangkat pengguna.
// Dipanggil oleh pg_cron tiap 5 menit (Authorization = service role key dari Vault).
// Deploy: supabase functions deploy send-push --no-verify-jwt
// Secret: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT

import { createClient } from "jsr:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush";

// --- util konversi VAPID (base64url <-> JWK) ---

function base64urlToArrayBuffer(base64url: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + padding;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64ToBase64url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function convertVapidKeysToJWK(publicKeyBase64url: string, privateKeyBase64url: string) {
  const publicKeyBuffer = base64urlToArrayBuffer(publicKeyBase64url);
  if (publicKeyBuffer.byteLength !== 65) {
    throw new Error("Invalid public key length. Expected 65 bytes for uncompressed P-256 key.");
  }
  const publicKeyBytes = new Uint8Array(publicKeyBuffer);
  const x = publicKeyBytes.slice(1, 33);
  const y = publicKeyBytes.slice(33, 65);
  const privateKeyBuffer = base64urlToArrayBuffer(privateKeyBase64url);

  return {
    publicKey: {
      kty: "EC",
      crv: "P-256",
      alg: "ES256",
      x: arrayBufferToBase64url(x.buffer),
      y: arrayBufferToBase64url(y.buffer),
      key_ops: ["verify"],
      ext: true,
    },
    privateKey: {
      kty: "EC",
      crv: "P-256",
      alg: "ES256",
      x: arrayBufferToBase64url(x.buffer),
      y: arrayBufferToBase64url(y.buffer),
      d: arrayBufferToBase64url(privateKeyBuffer),
      key_ops: ["sign"],
      ext: true,
    },
  };
}

Deno.serve(async (req) => {
  // Guard: hanya scheduler (pg_cron) dengan service role key yang boleh.
  const expected = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  if (req.headers.get("Authorization") !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Buat ulang pengingat untuk semua pengguna (jadwal hari ini, jatuh tempo, paket).
  await supabase.rpc("refresh_reminders_all");

  const [{ data: notifications }, { data: sentLog }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, user_id, ref_key, title, body, link")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("push_log").select("user_id, ref_key").limit(100000),
  ]);

  const sentKeys = new Set((sentLog ?? []).map((l) => `${l.user_id}:${l.ref_key}`));
  const pending = (notifications ?? []).filter((n) => !sentKeys.has(`${n.user_id}:${n.ref_key}`));
  if (pending.length === 0) {
    return new Response(JSON.stringify({ processed: 0, sent: 0, skipped: 0 }), { status: 200 });
  }

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@mudahmengajar.id";
  if (!publicKey || !privateKey) {
    return new Response(JSON.stringify({ error: "VAPID keys are not configured" }), { status: 500 });
  }

  const vapidKeys = await webpush.importVapidKeys(
    convertVapidKeysToJWK(publicKey, privateKey),
    { extractable: false }
  );
  const appServer = await webpush.ApplicationServer.new({
    contactInformation: subject,
    vapidKeys,
  });

  let sent = 0;
  const errors: { ref_key: string; message: string }[] = [];
  const newLog: { user_id: string; ref_key: string }[] = [];

  for (const n of pending) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", n.user_id);

    let delivered = false;
    for (const sub of subs ?? []) {
      try {
        const subscriber = appServer.subscribe({
          endpoint: sub.endpoint,
          keys: {
            p256dh: base64ToBase64url(sub.p256dh),
            auth: base64ToBase64url(sub.auth),
          },
        });
        await subscriber.pushTextMessage(
          JSON.stringify({ title: n.title, body: n.body ?? "", url: n.link ?? "/dashboard", tag: n.ref_key }),
          {}
        );
        delivered = true;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Subscription kedaluwarsa/batal — bersihkan.
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
        errors.push({ ref_key: n.ref_key, message: (e as Error).message ?? "unknown" });
      }
    }

    if (delivered) {
      sent += 1;
      newLog.push({ user_id: n.user_id, ref_key: n.ref_key });
    }
  }

  if (newLog.length > 0) {
    await supabase.from("push_log").upsert(newLog, { onConflict: "user_id,ref_key" });
  }

  return new Response(
    JSON.stringify({ processed: pending.length, sent, errors: errors.slice(0, 20) }),
    { status: 200 }
  );
});

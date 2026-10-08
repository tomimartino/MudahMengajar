// Edge Function "send-push" — dikirim notifikasi Web Push ke perangkat pengguna.
// Dipanggil oleh pg_cron tiap menit (Authorization = service role key dari Vault).
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
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey || req.headers.get("Authorization")?.trim() !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const started = Date.now();
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let processed = 0, sent = 0, failed = 0;
  async function finish(status: number, message = "") {
    const { error } = await supabase.rpc("record_service_run", {
      p_service: "send-push", p_outcome: status >= 400 || failed > 0 ? "error" : "ok",
      p_processed: processed, p_sent: sent, p_failed: failed,
      p_duration_ms: Date.now() - started, p_message: message,
    });
    return new Response(JSON.stringify({ processed, sent, failed, ...(message ? { message } : {}) }), {
      status: error ? 503 : status, headers: { "Content-Type": "application/json" },
    });
  }
  try {
    const { error: reminderError } = await supabase.rpc("refresh_reminders_all");
    if (reminderError) return await finish(503, "Pengingat belum dapat diperbarui");
    const [notificationsResult, logsResult, blockedResult] = await Promise.all([
      supabase.from("notifications").select("id,user_id,ref_key,title,body,link").order("created_at", { ascending: false }).limit(200),
      supabase.from("push_log").select("user_id,ref_key").limit(100000),
      supabase.rpc("get_push_blocked_accounts"),
    ]);
    if (notificationsResult.error || logsResult.error || blockedResult.error) return await finish(503, "Data notifikasi belum dapat dimuat");
    const sentKeys = new Set((logsResult.data ?? []).map(l => `${l.user_id}:${l.ref_key}`));
    const blocked = new Set(blockedResult.data ?? []);
    const pending = (notificationsResult.data ?? []).filter(n => !blocked.has(n.user_id) && !sentKeys.has(`${n.user_id}:${n.ref_key}`));
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY"), privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!publicKey || !privateKey) return await finish(503, "Konfigurasi push belum lengkap");
    if (!pending.length) return await finish(200);
    const vapidKeys = await webpush.importVapidKeys(convertVapidKeysToJWK(publicKey, privateKey), { extractable: false });
    const appServer = await webpush.ApplicationServer.new({ contactInformation: Deno.env.get("VAPID_SUBJECT") || "mailto:admin@mudahmengajar.id", vapidKeys });
    const newLog: { user_id: string; ref_key: string }[] = [];
    for (const n of pending) {
      processed += 1;
      // Recheck immediately before delivery; account status can change during a run.
      const { data: enabled, error: accessError } = await supabase.rpc("is_account_enabled", { p_user_id: n.user_id });
      if (accessError) { failed += 1; continue; }
      if (!enabled) continue;
      const { data: subs, error: subscriptionError } = await supabase.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", n.user_id);
      if (subscriptionError) { failed += 1; continue; }
      let delivered = false;
      for (const sub of subs ?? []) {
        try {
          await appServer.subscribe({ endpoint: sub.endpoint, keys: { p256dh: base64ToBase64url(sub.p256dh), auth: base64ToBase64url(sub.auth) } }).pushTextMessage(
            JSON.stringify({ title: n.title, body: n.body ?? "", url: n.link ?? "/dashboard", tag: n.ref_key }), {},
          );
          delivered = true;
        } catch (e) {
          failed += 1;
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
      if (delivered) { sent += 1; newLog.push({ user_id: n.user_id, ref_key: n.ref_key }); }
    }
    if (newLog.length) {
      const { error } = await supabase.from("push_log").upsert(newLog, { onConflict: "user_id,ref_key" });
      if (error) return await finish(503, "Hasil pengiriman belum tersimpan");
    }
    return await finish(200, failed ? "Sebagian pengiriman gagal" : "");
  } catch { return await finish(503, "Layanan notifikasi belum dapat dijalankan"); }
});

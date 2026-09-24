"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionError, fail, ok } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/helpers";
import type { Database } from "@/types/database.types";

const BUCKET = "avatars";
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Pastikan bucket avatars ada; buat (publik) jika belum dibuat. */
async function ensureAvatarBucket(storage: SupabaseClient<Database>) {
  const { data } = await storage.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await storage.storage.createBucket(BUCKET, { public: true });
  if (error) throw error;
}

export async function uploadAvatarAction(
  formData: FormData
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tidak terautentikasi.");

  const file = formData.get("file");
  if (!(file instanceof File)) return fail("File tidak valid.");

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return fail("Format harus PNG, JPG, atau WEBP.");
  if (file.size > MAX_SIZE) return fail("Ukuran maksimal foto 2 MB.");

  let uploadedUrl: string | null = null;
  try {
    const admin = await createAdminClient();
    const storage = admin ?? supabase;
    if (admin) await ensureAvatarBucket(storage);

    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .single();
    const oldUrl = profile?.avatar_url ?? null;

    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await storage.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type });
    if (uploadError) throw uploadError;

    const { data: publicUrl } = storage.storage.from(BUCKET).getPublicUrl(path);
    if (!publicUrl?.publicUrl) throw new Error("Gagal mendapatkan URL foto.");
    uploadedUrl = publicUrl.publicUrl;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: uploadedUrl })
      .eq("id", user.id);
    if (updateError) throw updateError;

    // Best-effort: hapus file avatar lama milik user ini.
    if (oldUrl && oldUrl !== uploadedUrl) {
      const match = oldUrl.match(new RegExp(`/${BUCKET}/(${user.id}/[^?]+)`));
      if (match) {
        try {
          await storage.storage.from(BUCKET).remove([match[1]]);
        } catch {
          // abaikan kegagalan penghapusan file lama
        }
      }
    }
  } catch (e) {
    return fail(actionError(e));
  }

  revalidatePath("/", "layout");
  return ok({ url: uploadedUrl });
}

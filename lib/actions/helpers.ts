export interface ActionResult<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
  conflict?: boolean;
  conflicts?: unknown[];
}

export function ok<T>(data?: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T>(error: string): ActionResult<T> {
  return { ok: false, error };
}

/** Ambil pesan error yang ramah dari exception (termasuk error Postgres/RLS). */
export function actionError(e: unknown): string {
  if (e instanceof Error) {
    const m = e.message
      .replace(/^P0001:\s*/, "")
      .replace(/^Error:\s*/, "")
      .replace(/^new row violates row-level security.*$/i, "Anda tidak memiliki akses ke data ini.")
      .replace(
        /^Could not find the '[^']+' (column|table).*$/i,
        "Struktur database belum diperbarui. Terapkan migrasi terbaru (supabase/migrations) di SQL Editor Supabase."
      )
      .trim();
    return m || "Terjadi kesalahan. Silakan coba lagi.";
  }
  return "Terjadi kesalahan. Silakan coba lagi.";
}

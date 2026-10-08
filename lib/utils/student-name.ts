export const DUPLICATE_STUDENT_MESSAGE =
  "Murid dengan nama yang sama sudah terdaftar. Gunakan Tambah Paket untuk menambah pertemuan.";

/** Recognize the database guard too, so simultaneous submissions get the same helpful message. */
export function isDuplicateStudentError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: unknown; message?: unknown };
  return value.code === "23505" && typeof value.message === "string" &&
    (value.message.includes("students_name_per_teacher") || value.message === DUPLICATE_STUDENT_MESSAGE);
}

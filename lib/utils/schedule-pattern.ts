import { format, getISODay } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export interface SchedulePattern {
  times: { day: number; start_time: string }[];
  startDate: string;
  location: string;
}

/**
 * Pola jadwal mendatang dari baris schedules: hari → jam mulai pertama per
 * hari, tanggal mulai (jadwal pertama), dan lokasi (jadwal pertama).
 * Dipakai untuk prefill form Edit Siswa dan form Tambah Paket.
 */
export function buildSchedulePattern(
  rows: { start_at: string; location: string | null }[] | null | undefined,
  tz: string
): SchedulePattern {
  const byDay = new Map<number, string>();
  let startDate = "";
  let location = "";
  for (const s of rows ?? []) {
    const local = toZonedTime(s.start_at, tz);
    const day = getISODay(local);
    if (!byDay.has(day)) byDay.set(day, format(local, "HH:mm"));
    if (!startDate) startDate = format(local, "yyyy-MM-dd");
    if (!location) location = s.location ?? "";
  }
  const times = [...byDay.entries()]
    .map(([day, start_time]) => ({ day, start_time }))
    .sort((a, b) => a.day - b.day);
  return { times, startDate, location };
}

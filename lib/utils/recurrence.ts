import { addDays, getISODay } from "date-fns";
import type { Json } from "@/types/database.types";

export type RecurrenceFrequency = "none" | "weekly" | "biweekly" | "custom";

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  /** 1 = tiap minggu, 2 = tiap 2 minggu (dipakai frequency weekly/biweekly). */
  interval: number;
  /** Hari ISO (1=Senin..7=Minggu) — dipakai frequency custom. */
  days: number[];
  /** Tanggal batas generate, format yyyy-MM-dd. */
  until: string;
}

export function isRecurring(rule: RecurrenceRule | null | undefined): boolean {
  return !!rule && rule.frequency !== "none";
}

/** Bentuk rule berdasarkan pilihan form. */
export function buildRule(
  frequency: RecurrenceFrequency,
  firstStart: Date,
  days: number[],
  until: string
): RecurrenceRule {
  return {
    frequency,
    interval: frequency === "biweekly" ? 2 : 1,
    days: frequency === "weekly" || frequency === "biweekly" ? [] : days,
    until,
  };
}

/**
 * Hitung tanggal occurrence berikutnya (jam sama dengan `from`).
 * weekly/biweekly: langkah 7 × interval; custom: cek keanggotaan hari.
 * `from` adalah start_at master — occurrence dimulai SETELAH tanggal master.
 */
export function occurrenceDates(rule: RecurrenceRule, from: Date, until: Date): Date[] {
  const results: Date[] = [];
  if (rule.frequency === "none") return results;

  if (rule.frequency === "custom") {
    if (rule.days.length === 0) return results;
    let cursor = addDays(from, 1);
    const limit = until.getTime();
    while (cursor.getTime() <= limit) {
      if (rule.days.includes(getISODay(cursor))) {
        results.push(new Date(cursor));
      }
      cursor = addDays(cursor, 1);
    }
    return results;
  }

  const step = 7 * Math.max(1, rule.interval);
  let cursor = addDays(from, step);
  const limit = until.getTime();
  while (cursor.getTime() <= limit) {
    results.push(new Date(cursor));
    cursor = addDays(cursor, step);
  }
  return results;
}

/** Serialisasi rule ke jsonb untuk disimpan di schedules.recurrence_rule. */
export function ruleToJson(rule: RecurrenceRule): Json {
  return {
    frequency: rule.frequency,
    interval: rule.interval,
    days: rule.days,
    until: rule.until,
  };
}

export function ruleFromJson(json: Json | null | undefined): RecurrenceRule | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const obj = json as Record<string, unknown>;
  const frequency = obj.frequency as RecurrenceFrequency | undefined;
  if (!frequency || frequency === "none") return null;
  return {
    frequency,
    interval: typeof obj.interval === "number" ? obj.interval : 1,
    days: Array.isArray(obj.days) ? (obj.days as number[]) : [],
    until: typeof obj.until === "string" ? obj.until : "",
  };
}

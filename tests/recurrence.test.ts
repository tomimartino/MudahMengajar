import { describe, expect, it } from "vitest";
import { addDays, parseISO } from "date-fns";
import { occurrenceDates, buildRule } from "@/lib/utils/recurrence";

const START = parseISO("2026-09-07T16:00:00+07:00"); // Senin
const UNTIL = parseISO("2026-10-31T00:00:00+07:00");

describe("occurrenceDates — weekly", () => {
  it("membuat occurrence tiap 7 hari setelah tanggal mulai", () => {
    const rule = buildRule("weekly", START, [], "2026-10-31");
    const dates = occurrenceDates(rule, START, UNTIL);
    expect(dates[0]).toEqual(addDays(START, 7));
    expect(dates[1]).toEqual(addDays(START, 14));
    expect(dates).toHaveLength(7); // 14, 21, 28 Sep; 5, 12, 19, 26 Okt
  });

  it("tidak melebihi batas until", () => {
    const rule = buildRule("weekly", START, [], "2026-09-20");
    const dates = occurrenceDates(rule, START, parseISO("2026-09-30T00:00:00+07:00"));
    expect(dates).toHaveLength(3); // 14, 21, 28 Sep
  });
});

describe("occurrenceDates — biweekly", () => {
  it("membuat occurrence tiap 14 hari", () => {
    const rule = buildRule("biweekly", START, [], "2026-10-31");
    const dates = occurrenceDates(rule, START, UNTIL);
    expect(dates[0]).toEqual(addDays(START, 14));
    expect(dates[1]).toEqual(addDays(START, 28));
    expect(dates).toHaveLength(3); // 21 Sep, 5 Okt, 19 Okt
  });
});

describe("occurrenceDates — custom", () => {
  it("hanya membuat occurrence pada hari terpilih", () => {
    // Senin(1) + Rabu(3)
    const rule = buildRule("custom", START, [1, 3], "2026-09-20");
    const dates = occurrenceDates(rule, START, parseISO("2026-09-20T00:00:00+07:00"));
    const weekdays = dates.map((d) => d.getDay());
    expect(dates).toHaveLength(3); // Rab 9, Sen 14, Rab 16
    expect(weekdays.every((w) => w === 1 || w === 3)).toBe(true);
  });

  it("mengembalikan array kosong jika tidak ada hari dipilih", () => {
    const rule = buildRule("custom", START, [], "2026-10-31");
    expect(occurrenceDates(rule, START, UNTIL)).toHaveLength(0);
  });
});

describe("buildRule", () => {
  it("weekly memakai interval 1 tanpa hari", () => {
    const rule = buildRule("weekly", START, [], "2026-12-31");
    expect(rule.interval).toBe(1);
    expect(rule.days).toHaveLength(0);
  });

  it("biweekly memakai interval 2", () => {
    const rule = buildRule("biweekly", START, [], "2026-12-31");
    expect(rule.interval).toBe(2);
  });

  it("custom menyimpan hari terpilih", () => {
    const rule = buildRule("custom", START, [2, 5], "2026-12-31");
    expect(rule.days).toEqual([2, 5]);
  });
});

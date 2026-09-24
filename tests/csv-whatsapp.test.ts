import { describe, expect, it } from "vitest";
import { toCSV } from "@/lib/utils/csv";
import { normalizePhone, invoiceReminderMessage } from "@/lib/utils/whatsapp";

describe("toCSV", () => {
  it("menghasilkan header dari key objek pertama", () => {
    const csv = toCSV([
      { Nama: "Andi", Nominal: 1000 },
      { Nama: "Siti", Nominal: 2000 },
    ]);
    expect(csv).toBe("Nama,Nominal\r\nAndi,1000\r\nSiti,2000");
  });

  it("meng-escape nilai dengan koma", () => {
    const csv = toCSV([{ Nama: "A, B", Catatan: "lulus, hebat" }]);
    expect(csv).toBe('Nama,Catatan\r\n"A, B","lulus, hebat"');
  });

  it("kosong untuk array kosong", () => {
    expect(toCSV([])).toBe("");
  });
});

describe("normalizePhone", () => {
  it("mengubah format 08 menjadi 62", () => {
    expect(normalizePhone("081234567890")).toBe("6281234567890");
  });

  it("mengubah +62 menjadi 62", () => {
    expect(normalizePhone("+6281234567890")).toBe("6281234567890");
  });

  it("membersihkan spasi dan strip", () => {
    expect(normalizePhone("0812-3456-7890")).toBe("6281234567890");
  });
});

describe("invoiceReminderMessage", () => {
  it("berisi nama wali, siswa, periode, nominal, dan jatuh tempo", () => {
    const msg = invoiceReminderMessage(
      {
        parentName: "Bapak Hendra",
        studentName: "Andi Pratama",
        periodLabel: "September 2026",
        amount: 500000,
        dueDate: "2026-09-10",
      },
      "Asia/Jakarta"
    );
    expect(msg).toContain("Bapak Hendra");
    expect(msg).toContain("Andi Pratama");
    expect(msg).toContain("September 2026");
    expect(msg).toContain("Rp500.000");
    expect(msg).toContain("10 September 2026");
  });
});

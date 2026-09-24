import { describe, expect, it } from "vitest";
import { renderTemplate } from "@/lib/utils/template";
import {
  invoiceReminderMessage,
  learningReportMessage,
} from "@/lib/utils/whatsapp";
import { DEFAULT_MESSAGE_TEMPLATES } from "@/lib/constants";

describe("renderTemplate", () => {
  it("mengganti placeholder dengan nilai", () => {
    const result = renderTemplate("Halo {{nama}}, total {{nominal}}.", {
      nama: "Bapak Hendra",
      nominal: "Rp500.000",
    });
    expect(result).toBe("Halo Bapak Hendra, total Rp500.000.");
  });

  it("membiarkan placeholder tanpa nilai", () => {
    const result = renderTemplate("Halo {{nama}}!", {});
    expect(result).toBe("Halo {{nama}}!");
  });
});

describe("invoiceReminderMessage", () => {
  it("memakai template kustom jika disediakan", () => {
    const msg = invoiceReminderMessage(
      {
        parentName: "Bapak Hendra",
        studentName: "Andi",
        periodLabel: "September 2026",
        amount: 500000,
        dueDate: "2026-09-10",
      },
      "Asia/Jakarta",
      "Yth. {{nama_wali}}, tagihan {{nama_siswa}} sebesar {{nominal}}."
    );
    expect(msg).toBe("Yth. Bapak Hendra, tagihan Andi sebesar Rp500.000.");
  });

  it("fallback ke template default", () => {
    const msg = invoiceReminderMessage(
      {
        parentName: "Bapak Hendra",
        studentName: "Andi",
        periodLabel: "September 2026",
        amount: 500000,
        dueDate: "2026-09-10",
      },
      "Asia/Jakarta"
    );
    expect(msg).toBe(DEFAULT_MESSAGE_TEMPLATES.invoice
      .replace("{{nama_wali}}", "Bapak Hendra")
      .replace("{{nama_siswa}}", "Andi")
      .replace("{{periode}}", "September 2026")
      .replace("{{nominal}}", "Rp500.000")
      .replace("{{jatuh_tempo}}", "10 September 2026"));
  });
});

describe("learningReportMessage", () => {
  it("merender template laporan belajar", () => {
    const msg = learningReportMessage(
      {
        parentName: "Ibu Maya",
        studentName: "Siti",
        sessionDate: "2026-09-18",
        material: "Persamaan Linear",
        score: 85,
        notes: "Sudah lancar",
        homework: "Latihan 3 soal",
      },
      "Asia/Jakarta",
      "{{nama_wali}}, materi {{nama_siswa}}: {{materi}} ({{nilai}})."
    );
    expect(msg).toBe("Ibu Maya, materi Siti: Persamaan Linear (85).");
  });
});

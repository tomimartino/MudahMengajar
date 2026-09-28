"use client";

import { MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildWaLink,
  invoiceReceiptMessage,
  invoiceReminderMessage,
  normalizePhone,
} from "@/lib/utils/whatsapp";

export function InvoiceActions({
  status,
  studentName,
  parentName,
  parentWhatsapp,
  periodLabel,
  remaining,
  paidTotal,
  dueDate,
  tz,
  template,
}: {
  status: string;
  studentName: string;
  parentName: string | null;
  parentWhatsapp: string | null;
  periodLabel: string;
  remaining: number;
  paidTotal: number;
  dueDate: string | null;
  tz: string;
  template: string | null;
}) {
  const phone = parentWhatsapp ? normalizePhone(parentWhatsapp) : null;

  const reminder = phone
    ? invoiceReminderMessage(
        {
          parentName: parentName ?? "Wali",
          studentName,
          periodLabel,
          amount: remaining,
          dueDate: dueDate ?? new Date(),
        },
        tz,
        template
      )
    : "";

  const receipt = invoiceReceiptMessage({
    parentName: parentName ?? "Wali",
    studentName,
    periodLabel,
    amount: paidTotal,
  });

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {status === "paid" ? (
        phone ? (
          <Button asChild size="sm">
            <a href={buildWaLink(phone, receipt)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4 text-emerald-600" /> Kirim Bukti Pembayaran
            </a>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Wali belum memiliki nomor WhatsApp.</p>
        )
      ) : phone ? (
        <Button asChild size="sm">
          <a href={buildWaLink(phone, reminder)} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="size-4 text-emerald-600" /> Tagih via WhatsApp
          </a>
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Wali belum memiliki nomor WhatsApp.</p>
      )}
      <Button variant="outline" size="sm" onClick={handlePrint}>
        <Printer className="size-4" /> Cetak
      </Button>
    </div>
  );
}

function isIosDevice() {
  const ua = navigator.userAgent;
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandaloneMode() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches)
  );
}

function handlePrint() {
  // window.print() tidak berfungsi di iOS saat app dibuka sebagai PWA standalone
  // (Add to Home Screen). Buka invoice di tab Safari baru dan cetak dari sana.
  if (isIosDevice() && isStandaloneMode()) {
    const url = new URL(window.location.href);
    url.searchParams.set("cetak", "1");
    const link = document.createElement("a");
    link.href = url.toString();
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }
  window.print();
}

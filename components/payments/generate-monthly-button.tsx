"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { toast } from "sonner";
import { CalendarSync, MessageCircle } from "lucide-react";
import { generateMonthlyInvoicesAction } from "@/lib/actions/payments";
import { Button } from "@/components/ui/button";

export function GenerateMonthlyButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function generate() {
    setPending(true);
    const now = new Date();
    const label = format(now, "MMMM yyyy", { locale: id });
    const result = await generateMonthlyInvoicesAction(now.getFullYear(), now.getMonth() + 1, label);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const count = result.data?.count ?? 0;
    toast.success(
      count > 0 ? `${count} tagihan bulanan dibuat.` : "Tidak ada tagihan baru (sudah dibuat semua)."
    );
    router.refresh();
  }

  return (
    <Button variant="outline" onClick={() => void generate()} disabled={pending}>
      <CalendarSync className="size-4" />
      {pending ? "Membuat..." : "Generate Tagihan Bulanan"}
    </Button>
  );
}

export function WhatsAppBillButton({
  phone,
  message,
}: {
  phone: string;
  message: string;
}) {
  return (
    <Button asChild variant="outline" size="sm">
      <a href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="size-4 text-emerald-600" /> Tagih via WhatsApp
      </a>
    </Button>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteInvoiceAction } from "@/lib/actions/payments";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";

export function InvoiceDeleteButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      title="Hapus tagihan?"
      description="Tagihan hanya bisa dihapus jika belum ada pembayaran."
      confirmLabel="Hapus"
      onConfirm={async () => {
        const result = await deleteInvoiceAction(invoiceId);
        if (result.ok) router.refresh();
        return result;
      }}
      trigger={
        <Button variant="ghost" size="icon" className="text-destructive" aria-label="Hapus tagihan">
          <Trash2 className="size-4" />
        </Button>
      }
    />
  );
}

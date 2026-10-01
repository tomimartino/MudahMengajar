"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileText, MoreHorizontal, ReceiptText, Trash2 } from "lucide-react";
import { deleteInvoiceAction } from "@/lib/actions/payments";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PaymentDialog,
  type PaymentFormInvoice,
  type PaymentFormStudent,
} from "@/components/payments/payment-form";

export function InvoiceRowActions({
  invoiceId,
  studentId,
  students,
  invoices,
  canPay,
  canDelete,
}: {
  invoiceId: string;
  studentId: string;
  students: PaymentFormStudent[];
  invoices: PaymentFormInvoice[];
  canPay: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [payOpen, setPayOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Aksi tagihan">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/invoices/${invoiceId}`}>
              <FileText className="size-4" /> Invoice
            </Link>
          </DropdownMenuItem>
          {canPay && (
            <DropdownMenuItem onSelect={() => setPayOpen(true)}>
              <ReceiptText className="size-4" /> Catat Pembayaran
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
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
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Trash2 className="size-4" /> Hapus
                  </DropdownMenuItem>
                }
              />
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        students={students}
        invoices={invoices}
        initialStudentId={studentId}
        initialInvoiceId={invoiceId}
      />
    </>
  );
}

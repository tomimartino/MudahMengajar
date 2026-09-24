"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ReceiptText } from "lucide-react";
import { recordPaymentAction } from "@/lib/actions/payments";
import { paymentSchema, type PaymentInput } from "@/lib/validations/payment";
import { PAYMENT_METHODS, PAYMENT_TYPES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/shared/submit-button";
import { formatRupiah } from "@/lib/utils/currency";

export interface PaymentFormStudent {
  id: string;
  full_name: string;
}

export interface PaymentFormInvoice {
  id: string;
  student_id: string;
  invoice_number: string;
  period_label: string | null;
  amount: string;
  paid_amount: number;
  type: string;
}

export function PaymentDialog({
  open,
  onOpenChange,
  students,
  invoices,
  initialStudentId,
  initialInvoiceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: PaymentFormStudent[];
  invoices: PaymentFormInvoice[];
  initialStudentId?: string;
  initialInvoiceId?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const form = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema) as unknown as Resolver<PaymentInput>,
    defaultValues: {
      student_id: initialStudentId ?? "",
      invoice_id: null,
      type: "other",
      amount: "",
      payment_date: new Date().toISOString().slice(0, 10),
      method: "cash",
      notes: "",
    },
  });

  const studentId = form.watch("student_id");
  const invoiceId = form.watch("invoice_id");

  const studentInvoices = invoices.filter((i) => i.student_id === studentId);

  function selectInvoice(id: string | null) {
    form.setValue("invoice_id", id, { shouldValidate: true });
    if (id) {
      const inv = invoices.find((i) => i.id === id);
      if (inv) {
        form.setValue("type", inv.type as PaymentInput["type"]);
        form.setValue(
          "amount",
          formatRupiah(Math.max(0, Number(inv.amount) - inv.paid_amount), { withSymbol: false })
        );
      }
    } else {
      form.setValue("type", "other");
      form.setValue("amount", "");
    }
  }

  function selectStudent(id: string) {
    form.setValue("student_id", id, { shouldValidate: true });
    selectInvoice(null);
  }

  useEffect(() => {
    if (!open || !initialInvoiceId) return;
    const inv = invoices.find((i) => i.id === initialInvoiceId);
    if (!inv) return;
    form.setValue("student_id", inv.student_id, { shouldValidate: true });
    selectInvoice(inv.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialInvoiceId]);

  async function onSubmit(values: PaymentInput) {
    setPending(true);
    const result = await recordPaymentAction(values);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Pembayaran berhasil dicatat.");
    onOpenChange(false);
    form.reset({
      student_id: "",
      invoice_id: null,
      type: "other",
      amount: "",
      payment_date: new Date().toISOString().slice(0, 10),
      method: "cash",
      notes: "",
    });
    router.refresh();
  }

  const selectedInvoice = invoiceId ? invoices.find((i) => i.id === invoiceId) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Catat Pembayaran</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="student_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Siswa</FormLabel>
                  <Select onValueChange={selectStudent} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih siswa" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="invoice_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tagihan (opsional)</FormLabel>
                  <Select
                    onValueChange={(v) => selectInvoice(v === "none" ? null : v)}
                    value={field.value ?? "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Tanpa tagihan" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Tanpa tagihan (ad-hoc)</SelectItem>
                      {studentInvoices.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.invoice_number} · {i.period_label ?? i.type} · sisa{" "}
                          {formatRupiah(Math.max(0, Number(i.amount) - i.paid_amount))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jenis</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(PAYMENT_TYPES).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Metode</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nominal</FormLabel>
                    <FormControl>
                      <Input placeholder="500.000" inputMode="numeric" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payment_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedInvoice && (
              <p className="text-xs text-muted-foreground">
                Sisa tagihan:{" "}
                {formatRupiah(Math.max(0, Number(selectedInvoice.amount) - selectedInvoice.paid_amount))}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <SubmitButton pending={pending} loadingText="Menyimpan...">
                Simpan Pembayaran
              </SubmitButton>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function RecordPaymentButton({
  students,
  invoices,
  studentId,
  invoiceId,
}: {
  students: PaymentFormStudent[];
  invoices: PaymentFormInvoice[];
  studentId: string;
  invoiceId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ReceiptText className="size-4" /> Catat Pembayaran
      </Button>
      <PaymentDialog
        open={open}
        onOpenChange={setOpen}
        students={students}
        invoices={invoices}
        initialStudentId={studentId}
        initialInvoiceId={invoiceId}
      />
    </>
  );
}

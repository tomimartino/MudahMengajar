import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { DateText } from "@/components/shared/date-text";
import { AmountText } from "@/components/shared/amount-text";
import { InvoiceStatusBadge } from "@/components/shared/badges";
import { InvoiceActions } from "@/components/payments/invoice-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PAYMENT_METHODS, PAYMENT_TYPES } from "@/lib/constants";
import { toDateInput, todayInTz } from "@/lib/utils/date";
import { formatRupiah } from "@/lib/utils/currency";

export const metadata: Metadata = { title: "Tagihan" };

const STATUS_FOOTER: Record<string, { tone: string; text: (sisa: string, dibayar: string) => string }> = {
  paid: {
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    text: (_sisa, dibayar) => `LUNAS — Pembayaran sebesar ${dibayar} telah diterima. Terima kasih!`,
  },
  partial: {
    tone: "border-amber-200 bg-amber-50 text-amber-800",
    text: (sisa) => `SEBAGIAN — Sisa tagihan ${sisa}.`,
  },
  unpaid: {
    tone: "border-red-200 bg-red-50 text-red-800",
    text: (sisa) => `BELUM BAYAR — Mohon selesaikan pembayaran sebesar ${sisa} sebelum jatuh tempo.`,
  },
};

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: settings }, { data: invoice }, { data: payments }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("business_name, full_name, whatsapp, address, timezone")
        .eq("id", user!.id)
        .single(),
      supabase
        .from("settings")
        .select("message_template_invoice")
        .eq("user_id", user!.id)
        .single(),
      supabase
        .from("invoices")
        .select("*, students(full_name, parents(name, whatsapp))")
        .eq("id", id)
        .eq("user_id", user!.id)
        .single(),
      supabase
        .from("payments")
        .select("payment_date, method, amount")
        .eq("invoice_id", id)
        .eq("user_id", user!.id)
        .order("payment_date"),
    ]);

  if (!invoice) notFound();

  const tz = profile?.timezone ?? "Asia/Jakarta";
  const businessName = profile?.business_name || profile?.full_name || "Bimbel";
  const student = invoice.students as unknown as {
    full_name: string;
    parents: { name: string; whatsapp: string } | null;
  } | null;
  const studentName = student?.full_name ?? "—";
  const parent = student?.parents ?? null;
  const periodLabel =
    invoice.period_label ?? PAYMENT_TYPES[invoice.type as keyof typeof PAYMENT_TYPES] ?? invoice.type;
  const paymentRows = (payments ?? []) as unknown as {
    payment_date: string;
    method: string;
    amount: string;
  }[];
  const paidTotal = paymentRows.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = Math.max(0, Number(invoice.amount) - paidTotal);
  const today = toDateInput(todayInTz(tz), tz);
  const footer = STATUS_FOOTER[invoice.status] ?? STATUS_FOOTER.unpaid;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="outline" size="sm">
          <Link href="/students?tab=payments">
            <ArrowLeft className="size-4" /> Kembali
          </Link>
        </Button>
        <InvoiceActions
          status={invoice.status}
          studentName={studentName}
          parentName={parent?.name ?? null}
          parentWhatsapp={parent?.whatsapp ?? null}
          periodLabel={periodLabel}
          remaining={remaining}
          paidTotal={paidTotal}
          dueDate={invoice.due_date}
          tz={tz}
          template={settings?.message_template_invoice ?? null}
        />
      </div>

      <div className="mx-auto max-w-2xl rounded-xl border bg-card">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b px-6 py-6 sm:px-8">
          <div className="min-w-0">
            <p className="text-xl font-bold tracking-tight">{businessName}</p>
            {profile?.address && (
              <p className="mt-1 text-sm text-muted-foreground">{profile.address}</p>
            )}
            {profile?.whatsapp && (
              <p className="text-sm text-muted-foreground">WA: {profile.whatsapp}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-base font-semibold tracking-wide">TAGIHAN</p>
            <p className="text-sm font-medium">{invoice.invoice_number}</p>
            <div className="mt-2 flex justify-end">
              <InvoiceStatusBadge
                status={invoice.status}
                dueDate={invoice.due_date}
                today={today}
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-6 sm:px-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ditujukan Kepada
              </h2>
              <p className="mt-1 font-medium">{studentName}</p>
              <p className="text-sm text-muted-foreground">Wali: {parent?.name ?? "—"}</p>
              <p className="text-sm text-muted-foreground">WA: {parent?.whatsapp ?? "—"}</p>
            </div>
            <div className="sm:text-right">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Detail Tagihan
              </h2>
              <p className="mt-1 text-sm">Periode: {periodLabel}</p>
              <p className="text-sm">
                Diterbitkan: <DateText value={invoice.created_at} tz={tz} />
              </p>
              <p className="text-sm">
                Jatuh tempo:{" "}
                {invoice.due_date ? <DateText value={invoice.due_date} tz={tz} /> : "—"}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-2 rounded-lg border p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Tagihan</span>
              <AmountText value={invoice.amount} className="font-medium" />
            </div>
            {paidTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Dibayar</span>
                <AmountText value={paidTotal} />
              </div>
            )}
            {invoice.status !== "paid" && (
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Sisa Tagihan</span>
                <AmountText value={remaining} />
              </div>
            )}
          </div>

          {paymentRows.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <ReceiptText className="size-4 text-primary" /> Riwayat Pembayaran
              </h3>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Metode</TableHead>
                      <TableHead className="text-right">Nominal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentRows.map((p) => (
                      <TableRow key={`${p.payment_date}-${p.amount}`}>
                        <TableCell>
                          <DateText value={p.payment_date} tz={tz} />
                        </TableCell>
                        <TableCell>
                          {PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] ?? p.method}
                        </TableCell>
                        <TableCell className="text-right">
                          <AmountText value={p.amount} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <div className={`mt-6 rounded-lg border p-4 text-center text-sm font-semibold ${footer.tone}`}>
            {footer.text(formatRupiah(remaining), formatRupiah(paidTotal))}
          </div>
        </div>
      </div>
    </div>
  );
}

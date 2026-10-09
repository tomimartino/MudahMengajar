import { ReceiptText, Wallet } from "lucide-react";
import { createClient, getCurrentUser, getCurrentProfile } from "@/lib/supabase/server";
import { loadBillingSummary, loadMonthInvoices, loadMonthPayments } from "@/lib/finance/overview";
import { MONTH_KEY_RE } from "@/lib/finance/queries";
import { PaymentPagination } from "@/components/finance/payment-pagination";
import { DateText } from "@/components/shared/date-text";
import { AmountText } from "@/components/shared/amount-text";
import { EmptyState } from "@/components/shared/empty-state";
import { InvoiceStatusBadge } from "@/components/shared/badges";
import { InvoiceRowActions } from "@/components/payments/invoice-row-actions";
import { MonthYearFilter } from "@/components/payments/month-filter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { todayInTz, toDateInput } from "@/lib/utils/date";

const PAYMENT_METHODS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Transfer Bank",
  ewallet: "E-Wallet",
  other: "Lainnya",
};
const PAYMENT_TYPES: Record<string, string> = {
  package: "Paket",
  monthly: "Bulanan",
  per_session: "Per Pertemuan",
  other: "Lainnya",
};

export async function PaymentsTabContent({ month, page = 1 }: { month?: string; page?: number }) {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: profile } = await getCurrentProfile(user!.id);
  const tz = profile?.timezone ?? "Asia/Jakarta";
  const today = toDateInput(todayInTz(tz), tz);
  const todayMonth = today.slice(0, 7);

  // Bulan terpilih (default bulan berjalan); filter tagihan & transaksi sesuai bulan.
  const selectedMonth = typeof month === "string" && MONTH_KEY_RE.test(month) ? month : todayMonth;
  const selYear = Number(selectedMonth.slice(0, 4));

  const [{ data: students }, summary, invoices, paymentPage] =
    await Promise.all([
      supabase
        .from("students")
        .select("id, full_name")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .order("full_name"),
      loadBillingSummary(supabase),
      loadMonthInvoices(supabase, selectedMonth),
      loadMonthPayments(supabase, user!.id, selectedMonth, page),
    ]);

  // Tagihan mengikuti jatuh tempo; transaksi mengikuti tanggal pembayaran yang dipilih guru.
  const payments = paymentPage.payments;
  const billingYears = summary.map((row) => Number(row.month_key.slice(0, 4)));
  const minYear = Math.min(...billingYears, Number(todayMonth.slice(0, 4)), selYear);
  const maxYear = Math.max(...billingYears, Number(todayMonth.slice(0, 4)), selYear);
  const years: string[] = [];
  for (let y = maxYear; y >= minYear; y--) years.push(String(y));

  const invoiceList = invoices.map((i) => {
    return {
      ...i,
      student_name: i.students?.full_name ?? "—",
      paid_amount: Number(i.paid_amount),
    };
  });

  const invoiceOptions = invoiceList.map((i) => ({
    id: i.id,
    student_id: i.student_id,
    invoice_number: i.invoice_number,
    period_label: i.period_label,
    amount: i.amount,
    paid_amount: i.paid_amount,
    type: i.type,
  }));

  return (
    <div>
      <div className="mb-4">
        <MonthYearFilter month={selectedMonth} years={years} />
      </div>

      <div className="mb-4 mt-5 flex gap-1 border-b">
        <span className="flex items-center gap-1.5 border-b-2 border-primary px-3 py-2 text-sm font-medium text-primary">
          <ReceiptText className="size-4" /> Tagihan
        </span>
        <a
          href="#transaksi"
          className="flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <Wallet className="size-4" /> Transaksi
        </a>
      </div>

      {invoiceList.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="Belum ada tagihan."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Tagihan</TableHead>
                <TableHead>Siswa</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Nominal</TableHead>
                <TableHead>Dibayar</TableHead>
                <TableHead>Jatuh Tempo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoiceList.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.invoice_number}</TableCell>
                  <TableCell>{i.student_name}</TableCell>
                  <TableCell>{i.period_label ?? PAYMENT_TYPES[i.type] ?? i.type}</TableCell>
                  <TableCell>
                    <AmountText value={i.amount} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {i.paid_amount > 0 ? <AmountText value={i.paid_amount} /> : "—"}
                  </TableCell>
                  <TableCell>
                    {i.due_date ? <DateText value={i.due_date} tz={tz} /> : "—"}
                  </TableCell>
                  <TableCell>
                    <InvoiceStatusBadge status={i.status} dueDate={i.due_date} today={today} />
                  </TableCell>
                  <TableCell>
                    <InvoiceRowActions
                      invoiceId={i.id}
                      studentId={i.student_id}
                      students={students ?? []}
                      invoices={invoiceOptions}
                      canPay={i.status !== "paid"}
                      canDelete={i.status === "unpaid" && i.paid_amount === 0}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <h3 id="transaksi" className="mb-2 mt-8 flex items-center gap-2 text-base font-semibold">
        <Wallet className="size-4 text-primary" /> Transaksi
      </h3>
      {(payments ?? []).length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Belum ada transaksi pembayaran."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Siswa</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Nominal</TableHead>
                <TableHead>Metode</TableHead>
                <TableHead>Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payments ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <DateText value={p.payment_date} tz={tz} />
                  </TableCell>
                  <TableCell className="font-medium">
                    {p.students?.full_name ?? "—"}
                  </TableCell>
                  <TableCell>{PAYMENT_TYPES[p.type] ?? p.type}</TableCell>
                  <TableCell>
                    <AmountText value={p.amount} />
                  </TableCell>
                  <TableCell>{PAYMENT_METHODS[p.method] ?? p.method}</TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">
                    {p.notes ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <PaymentPagination {...paymentPage} pathname="/payments" month={selectedMonth} />
    </div>
  );
}

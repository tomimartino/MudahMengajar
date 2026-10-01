import { ReceiptText, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DateText } from "@/components/shared/date-text";
import { AmountText } from "@/components/shared/amount-text";
import { EmptyState } from "@/components/shared/empty-state";
import { InvoiceStatusBadge } from "@/components/shared/badges";
import { InvoiceRowActions } from "@/components/payments/invoice-row-actions";
import { GenerateMonthlyButton } from "@/components/payments/generate-monthly-button";
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

export async function PaymentsTabContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user!.id)
    .single();
  const tz = profile?.timezone ?? "Asia/Jakarta";
  const today = toDateInput(todayInTz(tz), tz);

  const [{ data: students }, { data: invoices }, { data: payments }, { data: invoicePayments }] =
    await Promise.all([
      supabase
        .from("students")
        .select("id, full_name")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .order("full_name"),
      supabase
        .from("invoices")
        .select("*, students(full_name)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("payments")
        .select("*, students(full_name)")
        .eq("user_id", user!.id)
        .order("payment_date", { ascending: false })
        .limit(200),
      supabase
        .from("payments")
        .select("invoice_id, amount")
        .eq("user_id", user!.id)
        .not("invoice_id", "is", null)
        .limit(2000),
    ]);

  const paidByInvoice = new Map<string, number>();
  for (const p of invoicePayments ?? []) {
    if (!p.invoice_id) continue;
    paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) ?? 0) + Number(p.amount));
  }

  const invoiceList = (invoices ?? []).map((i) => {
    const student = i.students as unknown as {
      full_name: string;
    };
    return {
      ...i,
      student_name: student.full_name,
      paid_amount: paidByInvoice.get(i.id) ?? 0,
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
      <div className="mb-4 flex flex-wrap gap-2">
        <GenerateMonthlyButton />
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
          description="Tagihan dibuat otomatis saat siswa baru disimpan, atau buat tagihan manual / generate tagihan bulanan."
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
          description="Catat pembayaran dari siswa untuk mulai melacak pemasukan."
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
                    {(p.students as unknown as { full_name: string }).full_name}
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
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptText, TrendingUp, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { YearFilter } from "@/components/finance/year-filter";
import { StatCard } from "@/components/shared/stat-card";
import { AmountText } from "@/components/shared/amount-text";
import { DateText } from "@/components/shared/date-text";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  aggregateInvoiceMonthly,
  aggregateMonthly,
  MONTH_KEY_RE,
  monthLabel,
} from "@/lib/finance/queries";
import { PAYMENT_METHODS, PAYMENT_TYPES } from "@/lib/constants";
import { toDateInput, todayInTz } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Keuangan" };

type PaymentRow = {
  payment_date: string;
  amount: string;
  student_id: string;
  type: string;
  method: string;
  notes: string | null;
  students: { full_name: string } | null;
};

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
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
  const todayMonth = toDateInput(todayInTz(tz), tz).slice(0, 7);
  const nowYear = todayMonth.slice(0, 4);

  // Rentang tahun yang tersedia berdasarkan data pembayaran & tagihan (selalu memuat tahun berjalan).
  const [{ data: oldestPayment }, { data: newestPayment }, { data: oldestInvoice }, { data: newestInvoice }] =
    await Promise.all([
      supabase
        .from("payments")
        .select("payment_date")
        .eq("user_id", user!.id)
        .order("payment_date")
        .limit(1),
      supabase
        .from("payments")
        .select("payment_date")
        .eq("user_id", user!.id)
        .order("payment_date", { ascending: false })
        .limit(1),
      supabase
        .from("invoices")
        .select("created_at")
        .eq("user_id", user!.id)
        .order("created_at")
        .limit(1),
      supabase
        .from("invoices")
        .select("created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
  const minYear = Math.min(
    Number((oldestPayment?.[0]?.payment_date ?? todayMonth).slice(0, 4)),
    Number((oldestInvoice?.[0]?.created_at ?? todayMonth).slice(0, 4)),
    Number(nowYear)
  );
  const maxYear = Math.max(
    Number((newestPayment?.[0]?.payment_date ?? todayMonth).slice(0, 4)),
    Number((newestInvoice?.[0]?.created_at ?? todayMonth).slice(0, 4)),
    Number(nowYear)
  );
  const years: string[] = [];
  for (let y = maxYear; y >= minYear; y--) years.push(String(y));

  const rawYear = typeof sp.year === "string" && /^\d{4}$/.test(sp.year) ? sp.year : nowYear;
  const year = years.includes(rawYear) ? rawYear : nowYear;

  const rawMonth = typeof sp.month === "string" ? sp.month : "";
  const month =
    MONTH_KEY_RE.test(rawMonth) && rawMonth.startsWith(year)
      ? rawMonth
      : year === nowYear
        ? todayMonth
        : `${year}-01`;

  const { data: payments } = await supabase
    .from("payments")
    .select("payment_date, amount, student_id, type, method, notes, students(full_name)")
    .eq("user_id", user!.id)
    .gte("payment_date", `${year}-01-01`)
    .lte("payment_date", `${year}-12-31`)
    .order("payment_date")
    .limit(2000);

  // Estimasi pendapatan: seluruh nominal tagihan tahun ini, sudah bayar maupun belum.
  const { data: invoices } = await supabase
    .from("invoices")
    .select("amount, created_at")
    .eq("user_id", user!.id)
    .gte("created_at", `${year}-01-01`)
    .lte("created_at", `${year}-12-31`)
    .limit(2000);

  const rows = (payments ?? []) as unknown as PaymentRow[];
  const aggregates = aggregateMonthly(rows);
  const invoiceEstimates = aggregateInvoiceMonthly(
    (invoices ?? []) as unknown as { created_at: string; amount: string }[]
  );
  const selected = aggregates.get(month) ?? {
    total: 0,
    count: 0,
    students: new Set<string>(),
  };
  const selectedPayments = rows.filter((p) => p.payment_date.startsWith(month));
  const label = monthLabel(month);
  const monthKeys = Array.from(
    { length: 12 },
    (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`
  );

  return (
    <div>
      <PageHeader
        title="Keuangan"
        description="Rekap pendapatan dan estimasi dari tagihan siswa."
      />

      <div className="mb-4">
        <YearFilter year={year} years={years} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          icon={Wallet}
          label={`Pendapatan ${label}`}
          value={<AmountText value={selected.total} />}
        />
        <StatCard
          icon={TrendingUp}
          tone="lilac"
          label={`Estimasi Pendapatan ${label}`}
          value={<AmountText value={invoiceEstimates.get(month) ?? 0} />}
          hint="Total tagihan siswa, sudah & belum bayar."
        />
      </div>

      <h2 className="mb-2 mt-8 flex items-center gap-2 text-base font-semibold">
        <TrendingUp className="size-4 text-primary" /> Estimasi Pendapatan per Bulan
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {monthKeys.map((k) => {
          const a = aggregates.get(k);
          const isCurrent = k === month;
          return (
            <Link
              key={k}
              href={`/finance?year=${year}&month=${k}`}
              className={cn(
                "rounded-2xl border bg-card p-5 shadow-soft transition-colors hover:border-primary/50",
                isCurrent && "border-primary bg-primary/5"
              )}
            >
              <p className={cn("text-sm font-semibold", isCurrent && "text-primary")}>
                {monthLabel(k)}
              </p>
              <p className="mt-2 text-xl font-bold tracking-tight">
                <AmountText value={invoiceEstimates.get(k) ?? 0} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pendapatan: <AmountText value={a?.total ?? 0} />
              </p>
            </Link>
          );
        })}
      </div>

      <h2 className="mb-2 mt-8 flex items-center gap-2 text-base font-semibold">
        <ReceiptText className="size-4 text-primary" /> Rincian Pembayaran — {label}
      </h2>
      {selectedPayments.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={`Tidak ada pembayaran pada ${label}.`}
          description="Pembayaran yang dicatat akan muncul di sini."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Siswa</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Metode</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedPayments.map((p) => (
                <TableRow key={`${p.payment_date}-${p.student_id}-${p.amount}`}>
                  <TableCell>
                    <DateText value={p.payment_date} tz={tz} />
                  </TableCell>
                  <TableCell className="font-medium">
                    {p.students?.full_name ?? "—"}
                  </TableCell>
                  <TableCell>{PAYMENT_TYPES[p.type as keyof typeof PAYMENT_TYPES] ?? p.type}</TableCell>
                  <TableCell>{PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] ?? p.method}</TableCell>
                  <TableCell className="text-right">
                    <AmountText value={p.amount} />
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50">
                <TableCell colSpan={4} className="text-right font-semibold">
                  Total
                </TableCell>
                <TableCell className="text-right font-semibold">
                  <AmountText value={selected.total} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptText, TrendingUp, Wallet } from "lucide-react";
import { createClient, getCurrentUser, getCurrentProfile } from "@/lib/supabase/server";
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
  MONTH_KEY_RE,
  monthLabel,
} from "@/lib/finance/queries";
import { billingPage, loadBillingSummary, loadMonthPayments } from "@/lib/finance/overview";
import { PaymentPagination } from "@/components/finance/payment-pagination";
import { PAYMENT_METHODS, PAYMENT_TYPES } from "@/lib/constants";
import { toDateInput, todayInTz } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Keuangan" };

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const user = await getCurrentUser();

  const [{ data: profile }, summary] = await Promise.all([
    getCurrentProfile(user!.id), loadBillingSummary(supabase),
  ]);
  const tz = profile?.timezone ?? "Asia/Jakarta";
  const todayMonth = toDateInput(todayInTz(tz), tz).slice(0, 7);
  const nowYear = todayMonth.slice(0, 4);

  const invoiceEstimates = new Map(summary.map((row) => [row.month_key, Number(row.estimated_income)]));
  const aggregates = new Map(summary.map((row) => [row.month_key, { total: Number(row.income), count: Number(row.payment_count) }]));
  // Estimasi mengikuti jatuh tempo; pendapatan mengikuti tanggal pembayaran, termasuk lintas tahun.
  const billingYears = Array.from(
    new Set([...invoiceEstimates.keys(), ...aggregates.keys()]),
    (key) => Number(key.slice(0, 4))
  );
  const minYear = Math.min(...billingYears, Number(nowYear));
  const maxYear = Math.max(...billingYears, Number(nowYear));
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

  const selected = aggregates.get(month) ?? {
    total: 0,
    count: 0,
  };
  const paymentPage = await loadMonthPayments(supabase, user!.id, month, billingPage(sp.page), true);
  const selectedPayments = paymentPage.payments;
  const label = monthLabel(month);
  const monthKeys = Array.from(
    { length: 12 },
    (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`
  );

  return (
    <div>
      <PageHeader
        title="Keuangan"
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
        />
      </div>

      <h2 className="mb-2 mt-8 flex items-center gap-2 text-base font-semibold">
        <Wallet className="size-4 text-primary" /> Pendapatan dan Estimasi per Bulan
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
              <p className="mt-3 text-xs text-muted-foreground">Pendapatan</p>
              <p className="mt-1 text-xl font-bold tracking-tight">
                <AmountText value={a?.total ?? 0} />
              </p>
              <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                Estimasi: <AmountText value={invoiceEstimates.get(k) ?? 0} />
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
                <TableRow key={p.id}>
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
      <PaymentPagination {...paymentPage} pathname="/finance" month={month} year={year} />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptText, Users, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { MonthFilter } from "@/components/finance/month-filter";
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
  aggregateMonthly,
  lastTwelveMonthKeys,
  monthDateRange,
  monthLabel,
} from "@/lib/finance/queries";
import { PAYMENT_METHODS, PAYMENT_TYPES } from "@/lib/constants";
import { buildMonthOptions, toDateInput, todayInTz } from "@/lib/utils/date";
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

  const rawMonth = typeof sp.month === "string" ? sp.month : "";
  const monthNum = Number(rawMonth.slice(5, 7));
  const month =
    MONTH_KEY_RE.test(rawMonth) && monthNum >= 1 && monthNum <= 12 ? rawMonth : todayMonth;

  const range = monthDateRange(month);
  const oldest = `${lastTwelveMonthKeys(month)[11]}-01`;

  const { data: payments } = await supabase
    .from("payments")
    .select("payment_date, amount, student_id, type, method, notes, students(full_name)")
    .eq("user_id", user!.id)
    .gte("payment_date", oldest)
    .lte("payment_date", range.end)
    .order("payment_date")
    .limit(2000);

  const rows = (payments ?? []) as unknown as PaymentRow[];
  const aggregates = aggregateMonthly(rows);
  const selected = aggregates.get(month) ?? {
    total: 0,
    count: 0,
    students: new Set<string>(),
  };
  const selectedPayments = rows.filter((p) => p.payment_date.startsWith(month));
  const label = monthLabel(month);
  const monthKeys = lastTwelveMonthKeys(month);
  const monthOptions = buildMonthOptions(month, todayMonth);

  return (
    <div>
      <PageHeader
        title="Keuangan"
        description="Rekap pendapatan bulanan dari pembayaran siswa."
      />

      <div className="mb-4">
        <MonthFilter options={monthOptions} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Wallet}
          label={`Pendapatan ${label}`}
          value={<AmountText value={selected.total} />}
        />
        <StatCard icon={ReceiptText} label="Transaksi" value={selected.count} />
        <StatCard icon={Users} label="Siswa Membayar" value={selected.students.size} />
      </div>

      <h2 className="mb-2 mt-8 flex items-center gap-2 text-base font-semibold">
        <Wallet className="size-4 text-primary" /> Pendapatan per Bulan
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {monthKeys.map((k) => {
          const a = aggregates.get(k);
          const isCurrent = k === month;
          return (
            <Link
              key={k}
              href={`/finance?month=${k}`}
              className={cn(
                "rounded-xl border bg-card p-4 transition-colors hover:border-primary/50",
                isCurrent && "border-primary bg-primary/5"
              )}
            >
              <p className={cn("text-sm font-semibold", isCurrent && "text-primary")}>
                {monthLabel(k)}
              </p>
              <p className="mt-2 text-xl font-bold tracking-tight">
                <AmountText value={a?.total ?? 0} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {a?.count ?? 0} transaksi · {a?.students.size ?? 0} siswa
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

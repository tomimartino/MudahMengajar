import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileBarChart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { ReportFilters } from "@/components/reports/report-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildReport, type ReportType } from "@/lib/reports/queries";
import { formatRupiah } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Laporan" };

const REPORT_TYPES: { key: ReportType; label: string }[] = [
  { key: "students", label: "Laporan Siswa" },
  { key: "sessions", label: "Laporan Pertemuan" },
  { key: "attendance", label: "Laporan Kehadiran" },
  { key: "payments", label: "Laporan Pembayaran" },
];

const MONEY_HEADERS = new Set(["Total", "Nominal", "Tagihan Belum Lunas"]);

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const type: ReportType = REPORT_TYPES.some((t) => t.key === sp.type)
    ? (sp.type as ReportType)
    : "students";

  const now = new Date();
  const from =
    typeof sp.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)
      ? sp.from
      : new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to =
    typeof sp.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)
      ? sp.to
      : new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const student = typeof sp.student === "string" ? sp.student : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name")
    .eq("user_id", user!.id)
    .is("deleted_at", null)
    .order("full_name");

  const report = await buildReport(supabase, user!.id, type, { from, to, student });

  const exportHref = `/reports/export?type=${type}&from=${from}&to=${to}${student ? `&student=${student}` : ""}`;

  return (
    <div>
      <PageHeader
        title="Laporan"
        description="Rekap data bimbel dengan filter periode dan siswa."
        action={
          <Button asChild variant="outline">
            <Link href={exportHref}>
              <Download className="size-4" /> Export CSV
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex gap-1 overflow-x-auto border-b">
        {REPORT_TYPES.map((t) => (
          <Link
            key={t.key}
            href={`/reports?type=${t.key}&from=${from}&to=${to}${student ? `&student=${student}` : ""}`}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              type === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="mb-4">
        <ReportFilters students={students ?? []} />
      </div>

      {report.rows.length === 0 ? (
        <EmptyState
          icon={FileBarChart}
          title="Tidak ada data untuk periode ini."
          description="Coba ubah rentang tanggal atau filter siswa."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {report.headers.map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((row, i) => (
                <TableRow key={i}>
                  {report.headers.map((h) => {
                    const v = row[h];
                    const isMoney = MONEY_HEADERS.has(h) && typeof v === "number" && v !== 0;
                    return (
                      <TableCell key={h}>
                        {isMoney ? formatRupiah(v) : v === 0 && MONEY_HEADERS.has(h) ? "Rp0" : String(v ?? "—")}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

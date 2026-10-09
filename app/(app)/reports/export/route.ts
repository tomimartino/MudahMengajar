import { resolveReportFilters } from "@/lib/reports/filters";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildReport, type ReportType } from "@/lib/reports/queries";
import { csvResponse, toCSV } from "@/lib/utils/csv";

const VALID_TYPES: ReportType[] = [
  "students",
  "sessions",
  "finance",
  "payments",
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get("type") ?? "students";
  const type: ReportType = VALID_TYPES.includes(typeParam as ReportType)
    ? (typeParam as ReportType)
    : "students";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", user!.id).single();
  const { from, to, student } = resolveReportFilters(Object.fromEntries(searchParams), profile?.timezone ?? "Asia/Jakarta");

  const report = await buildReport(supabase, user.id, type, { from, to, student });
  const csv = toCSV(report.rows);
  const filename = `laporan-${type}-${from}_${to}.csv`;
  return csvResponse(csv, filename);
}

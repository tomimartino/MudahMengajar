import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildReport, type ReportType } from "@/lib/reports/queries";
import { csvResponse, toCSV } from "@/lib/utils/csv";

const VALID_TYPES: ReportType[] = [
  "students",
  "sessions",
  "attendance",
  "payments",
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get("type") ?? "students";
  const type: ReportType = VALID_TYPES.includes(typeParam as ReportType)
    ? (typeParam as ReportType)
    : "students";

  const now = new Date();
  const from =
    searchParams.get("from") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to =
    searchParams.get("to") ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const student = searchParams.get("student") ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const report = await buildReport(supabase, user.id, type, { from, to, student });
  const csv = toCSV(report.rows);
  const filename = `laporan-${type}-${from}_${to}.csv`;
  return csvResponse(csv, filename);
}

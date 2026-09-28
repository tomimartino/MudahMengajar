import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { InvoicePdf } from "@/components/payments/invoice-pdf";
import { PAYMENT_TYPES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { toDateInput, todayInTz } from "@/lib/utils/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const [{ data: profile }, { data: invoice }, { data: payments }] = await Promise.all([
    supabase
      .from("profiles")
      .select("business_name, full_name, whatsapp, address, timezone")
      .eq("id", user.id)
      .single(),
    supabase
      .from("invoices")
      .select("*, students(full_name, parents(name, whatsapp))")
      .eq("id", id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("payments")
      .select("payment_date, method, amount")
      .eq("invoice_id", id)
      .eq("user_id", user.id)
      .order("payment_date"),
  ]);

  if (!invoice) return new NextResponse("Not Found", { status: 404 });

  const tz = profile?.timezone ?? "Asia/Jakarta";
  const businessName = profile?.business_name || profile?.full_name || "Bimbel";
  const student = invoice.students as unknown as {
    full_name: string;
    parents: { name: string; whatsapp: string } | null;
  } | null;
  const parent = student?.parents ?? null;
  const periodLabel =
    invoice.period_label ??
    PAYMENT_TYPES[invoice.type as keyof typeof PAYMENT_TYPES] ??
    invoice.type;
  const paymentRows = (payments ?? []) as unknown as {
    payment_date: string;
    method: string;
    amount: string;
  }[];
  const paidTotal = paymentRows.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = Math.max(0, Number(invoice.amount) - paidTotal);
  const today = toDateInput(todayInTz(tz), tz);

  const pdf = await renderToBuffer(
    <InvoicePdf
      businessName={businessName}
      address={profile?.address ?? null}
      whatsapp={profile?.whatsapp ?? null}
      invoiceNumber={invoice.invoice_number}
      status={invoice.status}
      dueDate={invoice.due_date}
      today={today}
      studentName={student?.full_name ?? "—"}
      parentName={parent?.name ?? null}
      parentWhatsapp={parent?.whatsapp ?? null}
      periodLabel={periodLabel}
      createdAt={invoice.created_at}
      amount={Number(invoice.amount)}
      paidTotal={paidTotal}
      remaining={remaining}
      paymentRows={paymentRows}
      tz={tz}
    />
  );

  const safeNumber = String(invoice.invoice_number).replace(/[^a-zA-Z0-9-]+/g, "-");
  return new Response(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Tagihan-${safeNumber}.pdf"`,
    },
  });
}

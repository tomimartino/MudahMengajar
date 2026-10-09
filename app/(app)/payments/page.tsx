import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PaymentsTabContent } from "@/components/payments/payments-tab";
import { billingPage } from "@/lib/finance/overview";

export const metadata: Metadata = { title: "Pembayaran" };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const month = typeof sp.month === "string" ? sp.month : "";

  return (
    <div>
      <PageHeader
        title="Pembayaran"
      />
      <PaymentsTabContent month={month} page={billingPage(sp.page)} />
    </div>
  );
}

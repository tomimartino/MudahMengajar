import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PaymentsTabContent } from "@/components/payments/payments-tab";

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
        description="Kelola tagihan dan transaksi pembayaran siswa."
      />
      <PaymentsTabContent month={month} />
    </div>
  );
}

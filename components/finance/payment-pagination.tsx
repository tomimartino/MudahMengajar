import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PaymentPagination({ page, totalPages, count, pathname, month, year }: {
  page: number; totalPages: number; count: number; pathname: string; month: string; year?: string;
}) {
  if (totalPages <= 1) return null;
  const href = (target: number) => {
    const params = new URLSearchParams({ month, page: String(target) });
    if (year) params.set("year", year);
    return `${pathname}?${params}`;
  };
  return (
    <nav aria-label="Halaman transaksi" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">Halaman {page} dari {totalPages} · {count} transaksi</span>
      <div className="flex gap-2">
        {page > 1 && <Button asChild variant="outline" size="sm"><Link prefetch={false} href={href(page - 1)}>Sebelumnya</Link></Button>}
        {page < totalPages && <Button asChild variant="outline" size="sm"><Link prefetch={false} href={href(page + 1)}>Berikutnya</Link></Button>}
      </div>
    </nav>
  );
}

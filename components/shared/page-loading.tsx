import { Skeleton } from "@/components/ui/skeleton";

export function PageLoading() {
  return (
    <div role="status" aria-label="Memuat halaman" className="space-y-6">
      <span className="sr-only">Memuat halaman...</span>
      <div aria-hidden="true" className="space-y-6">
        <Skeleton className="h-8 w-44" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <Skeleton className="h-6 w-48" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

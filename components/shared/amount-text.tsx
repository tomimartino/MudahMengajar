import { formatRupiah } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";

export function AmountText({
  value,
  className,
  withSymbol = true,
}: {
  value: number | string | null | undefined;
  className?: string;
  withSymbol?: boolean;
}) {
  return (
    <span className={cn("tabular-nums", className)}>
      {formatRupiah(value, { withSymbol })}
    </span>
  );
}

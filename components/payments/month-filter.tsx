"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { MONTH_NAMES } from "@/lib/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function MonthYearFilter({
  month,
  years,
}: {
  month: string;
  years: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [year, monthNum] = month.split("-");

  function apply(nextMonth: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", nextMonth);
    router.push(`/payments?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <div>
        <Label className="mb-1 block text-xs">Bulan</Label>
        <Select
          value={monthNum}
          onValueChange={(v) => apply(`${year}-${v}`)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((name, i) => (
              <SelectItem key={name} value={String(i + 1).padStart(2, "0")}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="mb-1 block text-xs">Tahun</Label>
        <Select value={year} onValueChange={(v) => apply(`${v}-${monthNum}`)}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

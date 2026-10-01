"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function YearFilter({
  year,
  years,
}: {
  year: string;
  years: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function apply(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", value);
    params.delete("month");
    router.push(`/finance?${params.toString()}`);
  }

  return (
    <div>
      <Label className="mb-1 block text-xs">Tahun</Label>
      <Select value={year} onValueChange={apply}>
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
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { MONTH_NAMES } from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function MonthFilter({
  month,
  monthOptions,
}: {
  month: string;
  monthOptions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [year, monthNum] = month.split("-");

  const years = [
    ...new Set([...monthOptions.map((m) => m.value.slice(0, 4)), year].filter(Boolean)),
  ].sort() as string[];

  function apply(nextMonth: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("month", nextMonth);
    router.push(`/sessions?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <div>
        <Label className="mb-1 block text-xs">Bulan</Label>
        <Select
          value={monthNum ?? ""}
          onValueChange={(v) => apply(`${year ?? years[0] ?? new Date().getFullYear()}-${v}`)}
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
        <Select
          value={year ?? ""}
          onValueChange={(v) => apply(`${v}-${monthNum ?? "01"}`)}
        >
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

export function StudentFilter({
  students,
  studentId,
}: {
  students: { id: string; full_name: string }[];
  studentId: string;
}) {
  const router = useRouter();
  return (
    <div>
      <Label className="mb-1 block text-xs">Siswa</Label>
      <Select
        value={studentId || "all"}
        onValueChange={(v) => {
          const params = new URLSearchParams(window.location.search);
          if (v === "all") params.delete("student");
          else params.set("student", v);
          router.push(`/sessions?${params.toString()}`);
        }}
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua Siswa</SelectItem>
          {students.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.full_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

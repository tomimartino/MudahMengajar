"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function MonthFilter({
  month,
  monthOptions,
}: {
  month: string;
  monthOptions: { value: string; label: string }[];
}) {
  const router = useRouter();
  return (
    <Select
      value={month}
      onValueChange={(v) => {
        const params = new URLSearchParams(window.location.search);
        params.set("month", v);
        router.push(`/sessions?${params.toString()}`);
      }}
    >
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {monthOptions.map((m) => (
          <SelectItem key={m.value} value={m.value}>
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
  );
}

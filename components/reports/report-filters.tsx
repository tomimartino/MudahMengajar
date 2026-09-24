"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ReportFilters({
  students,
}: {
  students: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const student = searchParams.get("student") ?? "";

  function apply(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/reports?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Label className="mb-1 block text-xs">Dari</Label>
        <Input
          type="date"
          value={from}
          onChange={(e) => apply("from", e.target.value)}
          className="w-40"
        />
      </div>
      <div>
        <Label className="mb-1 block text-xs">Sampai</Label>
        <Input
          type="date"
          value={to}
          onChange={(e) => apply("to", e.target.value)}
          className="w-40"
        />
      </div>
      <div>
        <Label className="mb-1 block text-xs">Siswa</Label>
        <Select value={student || "all"} onValueChange={(v) => apply("student", v === "all" ? "" : v)}>
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
      {(from || to || student) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/reports?type=" + (searchParams.get("type") ?? "students"))}
        >
          <X className="size-4" /> Reset
        </Button>
      )}
    </div>
  );
}

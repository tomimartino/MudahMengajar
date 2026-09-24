"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPTIONS = [
  { value: "all", label: "Semua Status" },
  { value: "hadir", label: "Hadir" },
  { value: "izin", label: "Izin" },
  { value: "sakit", label: "Sakit" },
  { value: "alpha", label: "Alpha" },
  { value: "dibatalkan_guru", label: "Dibatalkan Guru" },
  { value: "dibatalkan_siswa", label: "Dibatalkan Siswa" },
];

export function StatusFilter({ status }: { status: string }) {
  const router = useRouter();
  return (
    <Select
      value={status || "all"}
      onValueChange={(v) => {
        const params = new URLSearchParams(window.location.search);
        if (v === "all") params.delete("status");
        else params.set("status", v);
        router.push(`/sessions?${params.toString()}`);
      }}
    >
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

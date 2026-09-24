"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SCHOOL_LEVELS } from "@/lib/constants";

export function StudentFilters({ subjects }: { subjects: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== "page") params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";
  const level = searchParams.get("level") ?? "";
  const subject = searchParams.get("subject") ?? "";
  const payment = searchParams.get("payment") ?? "";
  const hasFilter = !!(status || level || subject || payment || q);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari nama siswa, sekolah, kelas, atau wali..."
          defaultValue={q}
          className="pl-9"
          onKeyDown={(e) => {
            if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value || null);
          }}
          onBlur={(e) => setParam("q", e.target.value || null)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={status || "all"} onValueChange={(v) => setParam("status", v === "all" ? null : v)}>
          <SelectTrigger className="w-auto min-w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="inactive">Nonaktif</SelectItem>
          </SelectContent>
        </Select>
        <Select value={level || "all"} onValueChange={(v) => setParam("level", v === "all" ? null : v)}>
          <SelectTrigger className="w-auto min-w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Jenjang</SelectItem>
            {SCHOOL_LEVELS.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={subject || "all"} onValueChange={(v) => setParam("subject", v === "all" ? null : v)}>
          <SelectTrigger className="w-auto min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Mapel</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={payment || "all"} onValueChange={(v) => setParam("payment", v === "all" ? null : v)}>
          <SelectTrigger className="w-auto min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Pembayaran</SelectItem>
            <SelectItem value="open">Belum Lunas</SelectItem>
            <SelectItem value="overdue">Jatuh Tempo</SelectItem>
          </SelectContent>
        </Select>
        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
            <X className="size-4" /> Reset
          </Button>
        )}
      </div>
    </div>
  );
}

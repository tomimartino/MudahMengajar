"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PackagePlus, PackageX, SlidersHorizontal } from "lucide-react";
import {
  adjustPackageAction,
  cancelPackageAction,
} from "@/lib/actions/packages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/badges";
import { DateText } from "@/components/shared/date-text";
import { AmountText } from "@/components/shared/amount-text";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StudentForm, type StudentFormInitial } from "@/components/students/student-form";

export function AddPackageButton({
  subjects,
  initial,
  defaultLearningMode,
  defaultDurationMinutes,
}: {
  subjects: { id: string; name: string }[];
  initial: StudentFormInitial;
  defaultLearningMode?: "offline" | "online" | "hybrid";
  defaultDurationMinutes?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PackagePlus className="size-4" /> Tambah Paket
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tambah Paket Pertemuan</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Kolom terisi dari data siswa saat ini — ubah sesuai paket berikutnya.
            Paket &amp; tagihan otomatis dibuat saat disimpan.
          </p>
        </DialogHeader>
        <StudentForm
          mode="package"
          subjects={subjects}
          initial={initial}
          defaultLearningMode={defaultLearningMode}
          defaultDurationMinutes={defaultDurationMinutes}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

export interface PackageRow {
  id: string;
  total_sessions: number;
  price: number;
  start_date: string;
  status: string;
  sessions_used: number;
}

/** Kartu "Paket Pertemuan": pilih paket → detail + aksi Sesuaikan/Hapus; riwayat hanya status. */
export function PackagePanel({
  packages,
  timezone,
}: {
  packages: PackageRow[];
  timezone: string;
}) {
  const [selectedId, setSelectedId] = useState(
    packages.find((p) => p.status === "active")?.id ?? packages[0]?.id ?? ""
  );
  const selected = packages.find((p) => p.id === selectedId) ?? packages[0] ?? null;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Paket Pertemuan</CardTitle>
        {packages.length > 0 && (
          <Select value={selected?.id ?? ""} onValueChange={setSelectedId}>
            <SelectTrigger className="w-full sm:w-64" aria-label="Pilih paket">
              <SelectValue placeholder="Pilih paket" />
            </SelectTrigger>
            <SelectContent>
              {packages.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.total_sessions}x Pertemuan · <AmountText value={p.price} /> ·{" "}
                  <DateText value={p.start_date} tz={timezone} variant="shortDate" />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {selected ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
              <div>
                <p className="font-semibold">
                  {selected.total_sessions}x Pertemuan · <AmountText value={selected.price} />
                </p>
                <p className="text-sm text-muted-foreground">
                  Mulai <DateText value={selected.start_date} tz={timezone} />
                  {selected.status === "active" ? (
                    <>
                      {" "}· Terpakai {selected.sessions_used} · Sisa{" "}
                      <span className="font-semibold text-primary">
                        {selected.total_sessions - selected.sessions_used}
                      </span>
                    </>
                  ) : (
                    <> · Terpakai {selected.sessions_used}</>
                  )}
                </p>
              </div>
              {selected.status === "active" && (
                <div className="h-2 w-full rounded-full bg-muted sm:w-48">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{
                      width: `${Math.min(100, (selected.sessions_used / selected.total_sessions) * 100)}%`,
                    }}
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <StatusBadge
                  tone={selected.status === "active" ? "green" : selected.status === "completed" ? "gray" : "red"}
                >
                  {selected.status === "active"
                    ? "Aktif"
                    : selected.status === "completed"
                      ? "Selesai"
                      : "Dibatalkan"}
                </StatusBadge>
                {selected.status === "active" && (
                  <>
                    <AdjustPackageButton
                      packageId={selected.id}
                      currentUsed={selected.sessions_used}
                      total={selected.total_sessions}
                    />
                    <CancelPackageButton packageId={selected.id} />
                  </>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Riwayat paket</p>
              <div className="space-y-2">
                {packages.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span>
                      {p.total_sessions}x · <AmountText value={p.price} /> · mulai{" "}
                      <DateText value={p.start_date} tz={timezone} />
                    </span>
                    <StatusBadge
                      tone={p.status === "active" ? "green" : p.status === "completed" ? "gray" : "red"}
                    >
                      {p.status === "active" ? "Aktif" : p.status === "completed" ? "Selesai" : "Dibatalkan"}
                    </StatusBadge>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Belum ada paket. Klik &quot;Tambah Paket&quot; di atas untuk membuat paket.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function AdjustPackageButton({
  packageId,
  currentUsed,
  total,
}: {
  packageId: string;
  currentUsed: number;
  total: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(currentUsed));
  const [pending, setPending] = useState(false);

  async function save() {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > total) {
      toast.error(`Jumlah harus 0 sampai ${total}.`);
      return;
    }
    setPending(true);
    const result = await adjustPackageAction(packageId, n);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Sisa paket diperbarui.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <SlidersHorizontal className="size-4" /> Sesuaikan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Sesuaikan Paket Terpakai</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Koreksi manual jumlah pertemuan terpakai (0–{total}). Tidak mengubah riwayat presensi.
          </p>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            type="number"
            min={0}
            max={total}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => void save()} disabled={pending}>
              {pending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CancelPackageButton({ packageId }: { packageId: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      title="Hapus paket?"
      description="Paket akan berhenti aktif dan tagihannya dihapus. Jika tidak ada paket aktif lain, jadwal mendatang siswa juga dihapus dan siswa dinonaktifkan."
      confirmLabel="Hapus Paket"
      onConfirm={async () => {
        const result = await cancelPackageAction(packageId);
        if (result.ok) router.refresh();
        return result;
      }}
      trigger={
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
          <PackageX className="size-4" /> Hapus
        </Button>
      }
    />
  );
}

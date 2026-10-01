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
      title="Batalkan paket?"
      description="Paket akan berhenti aktif dan jadwal mendatang siswa dihapus dari kalender. Pertemuan yang sudah selesai tetap tercatat."
      confirmLabel="Batalkan Paket"
      onConfirm={async () => {
        const result = await cancelPackageAction(packageId);
        if (result.ok) router.refresh();
        return result;
      }}
      trigger={
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
          <PackageX className="size-4" /> Batalkan
        </Button>
      }
    />
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PackagePlus, PackageX, SlidersHorizontal } from "lucide-react";
import {
  adjustPackageAction,
  cancelPackageAction,
  createPackageAction,
} from "@/lib/actions/packages";
import { packageSchema, type PackageInput } from "@/lib/validations/package";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { SubmitButton } from "@/components/shared/submit-button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

export function CreatePackageButton({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const form = useForm<PackageInput>({
    resolver: zodResolver(packageSchema) as unknown as Resolver<PackageInput>,
    defaultValues: {
      student_id: studentId,
      total_sessions: undefined as unknown as number,
      price: "",
      start_date: "",
    },
  });

  async function onSubmit(values: PackageInput) {
    setPending(true);
    const result = await createPackageAction(values);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Paket berhasil dibuat dan tagihan diterbitkan.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PackagePlus className="size-4" /> Buat Paket
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Buat Paket Pertemuan</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Tagihan otomatis dibuat saat paket disimpan.
          </p>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="total_sessions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jumlah pertemuan</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="12" inputMode="numeric" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Harga paket (Rp)</FormLabel>
                  <FormControl>
                    <Input placeholder="1.200.000" inputMode="numeric" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal mulai</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <SubmitButton pending={pending} loadingText="Menyimpan...">
                Simpan Paket
              </SubmitButton>
            </div>
          </form>
        </Form>
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
      description="Paket akan berhenti aktif dan tidak lagi mengurangi pertemuan otomatis."
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

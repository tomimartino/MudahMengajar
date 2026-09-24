"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Award } from "lucide-react";
import {
  createAchievementAction,
  deleteAchievementAction,
  updateAchievementAction,
} from "@/lib/actions/profile";
import { achievementSchema, type AchievementInput } from "@/lib/validations/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { EmptyState } from "@/components/shared/empty-state";

interface AchievementRow {
  id: string;
  title: string;
  year: number | null;
  description: string | null;
}

export function AchievementSection({ achievements }: { achievements: AchievementRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AchievementRow | "new" | null>(null);
  const [pending, setPending] = useState(false);

  const form = useForm<AchievementInput>({
    resolver: zodResolver(achievementSchema) as unknown as Resolver<AchievementInput>,
    defaultValues: { title: "", year: "", description: "" },
  });

  function openEdit(row: AchievementRow | "new") {
    if (row === "new") {
      form.reset({ title: "", year: "", description: "" });
    } else {
      form.reset({
        title: row.title,
        year: row.year ? String(row.year) : "",
        description: row.description ?? "",
      });
    }
    setEditing(row);
  }

  async function onSubmit(values: AchievementInput) {
    if (!editing) return;
    setPending(true);
    const result =
      editing === "new"
        ? await createAchievementAction(values)
        : await updateAchievementAction(editing.id, values);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(editing === "new" ? "Sertifikat ditambahkan." : "Sertifikat diperbarui.");
    setEditing(null);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Award className="size-4 text-primary" /> Sertifikat
        </h2>
        <Button size="sm" variant="outline" onClick={() => openEdit("new")}>
          <Plus className="size-4" /> Tambah
        </Button>
      </div>

      {achievements.length === 0 ? (
        <EmptyState
          icon={Award}
          title="Belum ada sertifikat."
          description="Tampilkan sertifikatmu — sertifikasi mengajar, pelatihan, atau penghargaan."
        />
      ) : (
        <div className="space-y-3">
          {achievements.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-2 rounded-xl border p-4">
              <div>
                <p className="font-semibold">
                  <Award className="mr-1 inline size-4 text-amber-500" />
                  {a.title}
                </p>
                {a.year && <p className="text-sm text-muted-foreground">{a.year}</p>}
                {a.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>
                )}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(a)} aria-label="Edit">
                  <Pencil className="size-4" />
                </Button>
                <ConfirmDialog
                  title="Hapus sertifikat?"
                  description="Sertifikat ini akan dihapus dari profil."
                  confirmLabel="Hapus"
                  onConfirm={async () => {
                    const result = await deleteAchievementAction(a.id);
                    if (result.ok) router.refresh();
                    return result;
                  }}
                  trigger={
                    <Button variant="ghost" size="icon" className="text-destructive" aria-label="Hapus">
                      <Trash2 className="size-4" />
                    </Button>
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editing === "new" ? "Tambah Sertifikat" : "Edit Sertifikat"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Judul sertifikat</FormLabel>
                      <FormControl>
                        <Input placeholder="Contoh: Sertifikasi Guru Profesional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tahun</FormLabel>
                      <FormControl>
                        <Input type="number" inputMode="numeric" placeholder="2024" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deskripsi</FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                    Batal
                  </Button>
                  <SubmitButton pending={pending} loadingText="Menyimpan...">
                    Simpan
                  </SubmitButton>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Briefcase, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createExperienceAction,
  deleteExperienceAction,
  updateExperienceAction,
} from "@/lib/actions/profile";
import { experienceSchema, type ExperienceInput } from "@/lib/validations/profile";
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

interface ExperienceRow {
  id: string;
  institution: string;
  role: string | null;
  start_year: number;
  end_year: number | null;
  description: string | null;
}

export function ExperienceSection({ experiences }: { experiences: ExperienceRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<ExperienceRow | "new" | null>(null);
  const [pending, setPending] = useState(false);

  const form = useForm<ExperienceInput>({
    resolver: zodResolver(experienceSchema) as unknown as Resolver<ExperienceInput>,
    defaultValues: {
      institution: "",
      role: "",
      start_year: undefined as unknown as number,
      end_year: "",
      description: "",
    },
  });

  function openEdit(row: ExperienceRow | "new") {
    if (row === "new") {
      form.reset({
        institution: "",
        role: "",
        start_year: undefined as unknown as number,
        end_year: "",
        description: "",
      });
    } else {
      form.reset({
        institution: row.institution,
        role: row.role ?? "",
        start_year: row.start_year,
        end_year: row.end_year ? String(row.end_year) : "",
        description: row.description ?? "",
      });
    }
    setEditing(row);
  }

  async function onSubmit(values: ExperienceInput) {
    if (!editing) return;
    setPending(true);
    const result =
      editing === "new"
        ? await createExperienceAction(values)
        : await updateExperienceAction(editing.id, values);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(editing === "new" ? "Pengalaman ditambahkan." : "Pengalaman diperbarui.");
    setEditing(null);
    router.refresh();
  }

  function yearLabel(e: ExperienceRow) {
    return e.end_year ? `${e.start_year} – ${e.end_year}` : `${e.start_year} – Sekarang`;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Briefcase className="size-4 text-primary" /> Pengalaman Mengajar
        </h2>
        <Button size="sm" variant="outline" onClick={() => openEdit("new")}>
          <Plus className="size-4" /> Tambah
        </Button>
      </div>

      {experiences.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Belum ada riwayat mengajar."
          description="Tambahkan pengalaman mengajarmu untuk memperkuat profil."
        />
      ) : (
        <div className="space-y-3">
          {experiences.map((e) => (
            <div key={e.id} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{e.institution}</p>
                  <p className="text-sm text-muted-foreground">
                    {e.role ?? "Guru"} · {yearLabel(e)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(e)} aria-label="Edit">
                    <Pencil className="size-4" />
                  </Button>
                  <ConfirmDialog
                    title="Hapus pengalaman?"
                    description="Riwayat ini akan dihapus dari profil."
                    confirmLabel="Hapus"
                    onConfirm={async () => {
                      const result = await deleteExperienceAction(e.id);
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
              {e.description && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {e.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editing === "new" ? "Tambah Pengalaman" : "Edit Pengalaman"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="institution"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lembaga / tempat mengajar</FormLabel>
                      <FormControl>
                        <Input placeholder="Contoh: Bimbel Cerdas" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Peran</FormLabel>
                      <FormControl>
                        <Input placeholder="Contoh: Guru Matematika" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="start_year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tahun mulai</FormLabel>
                        <FormControl>
                          <Input type="number" inputMode="numeric" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="end_year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tahun selesai</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            placeholder="Kosongkan = sekarang"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
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

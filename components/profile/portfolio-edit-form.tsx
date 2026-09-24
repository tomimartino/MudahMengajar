"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { updatePortfolioAction } from "@/lib/actions/profile";
import { deleteSubjectAction } from "@/lib/actions/settings";
import { portfolioSchema, type PortfolioInput } from "@/lib/validations/profile";
import { formatRupiah } from "@/lib/utils/currency";
import { DEFAULT_SUBJECTS, LEARNING_MODES, SCHOOL_LEVELS, TIMEZONES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/shared/submit-button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";

export function PortfolioEditButton({
  initial,
  subjects,
}: {
  initial: {
    full_name: string;
    whatsapp: string | null;
    timezone: string;
    headline: string | null;
    bio: string | null;
    rate: string | null;
    career_start_year: number | null;
    address: string | null;
    teaching_levels: string[];
    learning_mode: string;
    slug: string;
  };
  subjects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [customSubject, setCustomSubject] = useState("");

  const form = useForm<PortfolioInput>({
    resolver: zodResolver(portfolioSchema) as unknown as Resolver<PortfolioInput>,
    defaultValues: {
      full_name: initial.full_name,
      whatsapp: initial.whatsapp ?? "",
      timezone: initial.timezone,
      subjects: subjects.map((s) => s.name),
      teaching_levels: initial.teaching_levels ?? [],
      learning_mode: (initial.learning_mode as "offline" | "online" | "hybrid") ?? "offline",
      slug: initial.slug ?? "",
      headline: initial.headline ?? "",
      bio: initial.bio ?? "",
      rate: initial.rate ? formatRupiah(initial.rate, { withSymbol: false }) : "",
      career_start_year: initial.career_start_year ? String(initial.career_start_year) : "",
      address: initial.address ?? "",
    },
  });

  const subjectNames = form.watch("subjects");
  const levels = form.watch("teaching_levels") ?? [];

  function toggleLevel(level: string) {
    const next = levels.includes(level)
      ? levels.filter((l) => l !== level)
      : [...levels, level];
    form.setValue("teaching_levels", next, { shouldValidate: true });
  }

  function toggleSubject(name: string) {
    const next = subjectNames.includes(name)
      ? subjectNames.filter((n) => n !== name)
      : [...subjectNames, name];
    form.setValue("subjects", next, { shouldValidate: true });
  }

  function addCustomSubject() {
    const name = customSubject.trim();
    if (!name) return;
    if (!subjectNames.includes(name)) {
      form.setValue("subjects", [...subjectNames, name], { shouldValidate: true });
    }
    setCustomSubject("");
  }

  async function onSubmit(values: PortfolioInput) {
    setPending(true);
    const result = await updatePortfolioAction(values);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Profil berhasil diperbarui.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" /> Edit Profil
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Profil</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Identitas</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="whatsapp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nomor WhatsApp</FormLabel>
                      <FormControl>
                        <Input inputMode="tel" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zona waktu</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TIMEZONES.map((tz) => (
                            <SelectItem key={tz.value} value={tz.value}>
                              {tz.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="learning_mode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Metode belajar</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(LEARNING_MODES).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="headline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Headline</FormLabel>
                      <FormControl>
                        <Input placeholder="Guru Matematika — SD sampai SMA" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Link profil kustom (opsional)</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-muted-foreground">/guru/</span>
                          <Input placeholder="mis. paktomi" {...field} />
                        </div>
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Huruf kecil, angka, dan tanda hubung. Kosongkan untuk memakai link
                        otomatis.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Mata Pelajaran</p>
              <div className="flex flex-wrap gap-2">
                {subjectNames.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-sm"
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() => toggleSubject(name)}
                      aria-label={`Hapus ${name}`}
                    >
                      <X className="size-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex max-w-sm gap-2">
                <Input
                  placeholder="Tambah mapel lain..."
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomSubject();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addCustomSubject}>
                  <Plus className="size-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_SUBJECTS.filter((s) => !subjectNames.includes(s)).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSubject(s)}
                    className="rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    + {s}
                  </button>
                ))}
              </div>
              {form.formState.errors.subjects && (
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.subjects.message}
                </p>
              )}
            </div>

            <div className="space-y-2 border-t pt-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Hapus mapel dari daftar
              </p>
              <p className="text-xs text-muted-foreground">
                Mapel yang masih dipakai siswa atau jadwal tidak dapat dihapus.
              </p>
              <div className="flex flex-wrap gap-2">
                {subjects.map((s) => (
                  <ConfirmDialog
                    key={s.id}
                    title={`Hapus ${s.name}?`}
                    description="Mapel akan dihapus dari daftar jika tidak sedang dipakai."
                    confirmLabel="Hapus"
                    onConfirm={async () => {
                      const result = await deleteSubjectAction(s.id);
                      if (result.ok) {
                        form.setValue(
                          "subjects",
                          form.getValues("subjects").filter((n) => n !== s.name),
                          { shouldValidate: true }
                        );
                        router.refresh();
                      }
                      return result;
                    }}
                    trigger={
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3" /> {s.name}
                      </button>
                    }
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2 border-t pt-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Jenjang yang diajar
              </p>
              <div className="flex flex-wrap gap-2">
                {SCHOOL_LEVELS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => toggleLevel(l)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      levels.includes(l)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/50 hover:text-primary"
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {form.formState.errors.teaching_levels && (
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.teaching_levels.message}
                </p>
              )}
            </div>

            <div className="space-y-4 border-t pt-4">
              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tentang</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={4}
                        placeholder="Ceritakan pendekatan mengajarmu..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tarif / pertemuan (Rp)</FormLabel>
                      <FormControl>
                        <Input placeholder="75.000" inputMode="numeric" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="career_start_year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tahun mulai mengajar</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="2018" inputMode="numeric" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lokasi</FormLabel>
                    <FormControl>
                      <Input placeholder="Jakarta Selatan" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <SubmitButton pending={pending} loadingText="Menyimpan...">
                Simpan Profil
              </SubmitButton>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

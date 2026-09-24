"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createStudentAction, updateStudentAction } from "@/lib/actions/students";
import { studentSchema, type StudentInput } from "@/lib/validations/student";
import {
  BILLING_TYPES,
  DAY_NAMES,
  GENDERS,
  GRADE_OPTIONS,
  LEARNING_MODES,
  SCHOOL_LEVELS,
  type SchoolLevel,
} from "@/lib/constants";
import { formatRupiah } from "@/lib/utils/currency";
import { toDateInput } from "@/lib/utils/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";

export interface StudentFormInitial {
  id?: string;
  full_name?: string;
  gender?: "L" | "P" | null;
  birth_date?: string;
  school_name?: string;
  school_level?: string;
  grade_level?: string;
  phone?: string;
  parent_name?: string;
  parent_whatsapp?: string;
  address?: string;
  notes?: string;
  learning_mode?: string;
  billing_type?: string;
  per_session_rate?: string | null;
  monthly_fee?: string | null;
  monthly_due_day?: number | null;
  subject_ids?: string[];
  status?: string;
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:border-primary/50 hover:text-primary"
      )}
    >
      {children}
    </button>
  );
}

export function StudentForm({
  subjects,
  initial,
  schoolLevels,
  defaultLearningMode,
  defaultDurationMinutes,
}: {
  subjects: { id: string; name: string }[];
  initial?: StudentFormInitial;
  schoolLevels?: SchoolLevel[];
  defaultLearningMode?: "offline" | "online" | "hybrid";
  defaultDurationMinutes?: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const isEdit = !!initial?.id;

  // Jenjang hanya yang diajar guru; sertakan jenjang lama siswa saat edit.
  const allowedLevels: SchoolLevel[] = [
    ...(schoolLevels && schoolLevels.length > 0 ? schoolLevels : [...SCHOOL_LEVELS]),
  ];
  if (initial?.school_level) {
    const current = initial.school_level as SchoolLevel;
    if (!allowedLevels.includes(current)) allowedLevels.push(current);
  }

  const form = useForm<StudentInput>({
    resolver: zodResolver(studentSchema) as unknown as Resolver<StudentInput>,
    defaultValues: {
      full_name: initial?.full_name ?? "",
      gender: (initial?.gender as "L" | "P" | null) ?? null,
      birth_date: initial?.birth_date ?? "",
      school_name: initial?.school_name ?? "",
      school_level:
        (initial?.school_level as SchoolLevel) ?? allowedLevels[0] ?? "SD",
      grade_level: initial?.grade_level ?? "1",
      phone: initial?.phone ?? "",
      parent_name: initial?.parent_name ?? "",
      parent_whatsapp: initial?.parent_whatsapp ?? "",
      address: initial?.address ?? "",
      notes: initial?.notes ?? "",
      learning_mode:
        (initial?.learning_mode as "offline" | "online" | "hybrid") ??
        defaultLearningMode ??
        "offline",
      billing_type: (initial?.billing_type as "per_session" | "package" | "monthly") ?? "package",
      per_session_rate: initial?.per_session_rate
        ? formatRupiah(initial.per_session_rate, { withSymbol: false })
        : "",
      monthly_fee: initial?.monthly_fee
        ? formatRupiah(initial.monthly_fee, { withSymbol: false })
        : "",
      monthly_due_day: initial?.monthly_due_day ? String(initial.monthly_due_day) : "",
      package_sessions: "",
      package_price: "",
      package_start_date: toDateInput(new Date()),
      subject_ids: initial?.subject_ids ?? [],
      status: (initial?.status as "active" | "inactive") ?? "active",
      schedule_days: [],
      schedule_start_time: "",
      schedule_location: "",
      schedule_start_date: toDateInput(new Date()),
    },
  });

  const billingType = form.watch("billing_type");
  const schoolLevel = form.watch("school_level") as SchoolLevel;
  const subjectIds = form.watch("subject_ids");
  const scheduleDays = form.watch("schedule_days") ?? [];

  function toggleScheduleDay(day: number) {
    const next = scheduleDays.includes(day)
      ? scheduleDays.filter((d) => d !== day)
      : [...scheduleDays, day];
    form.setValue("schedule_days", next, { shouldValidate: true });
  }

  function toggleSubject(id: string) {
    const next = subjectIds.includes(id)
      ? subjectIds.filter((v) => v !== id)
      : [...subjectIds, id];
    form.setValue("subject_ids", next, { shouldValidate: true });
  }

  async function onSubmit(values: StudentInput) {
    setPending(true);
    const result = isEdit
      ? await updateStudentAction(initial!.id!, values)
      : await createStudentAction(values);
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const data = result.data as { id?: string } | undefined;
    toast.success(
      isEdit
        ? "Data siswa berhasil diperbarui."
        : "Siswa berhasil ditambahkan. Tagihan & jadwal otomatis dibuat."
    );
    if (isEdit) {
      router.push(`/students/${initial!.id}`);
    } else if (data?.id) {
      router.push(`/students/${data.id}`);
    }
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">IDENTITAS SISWA</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Nama siswa *</FormLabel>
                  <FormControl>
                    <Input placeholder="Contoh: Andi Pratama" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jenis kelamin</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                    value={field.value ?? "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {Object.entries(GENDERS).map(([value, label]) => (
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
              name="birth_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal lahir</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nomor HP siswa</FormLabel>
                  <FormControl>
                    <Input placeholder="08xxxxxxxxxx" inputMode="tel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Alamat</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Alamat rumah siswa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">SEKOLAH</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="school_level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jenjang *</FormLabel>
                  <Select
                    onValueChange={(v) => {
                      field.onChange(v);
                      const first = GRADE_OPTIONS[v as SchoolLevel][0];
                      form.setValue("grade_level", first ?? "1");
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {allowedLevels.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
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
              name="grade_level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kelas *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {GRADE_OPTIONS[schoolLevel].map((g) => (
                        <SelectItem key={g} value={g}>
                          {schoolLevel === "Umum" ? "Umum" : `Kelas ${g}`}
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
              name="school_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sekolah</FormLabel>
                  <FormControl>
                    <Input placeholder="Contoh: SMP Negeri 1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">ORANG TUA / WALI</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="parent_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama orang tua / wali</FormLabel>
                  <FormControl>
                    <Input placeholder="Contoh: Bapak Hendra" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parent_whatsapp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nomor WhatsApp wali *</FormLabel>
                  <FormControl>
                    <Input placeholder="08xxxxxxxxxx" inputMode="tel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">PEMBELAJARAN</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="learning_mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mode belajar</FormLabel>
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
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Aktif</SelectItem>
                      <SelectItem value="inactive">Nonaktif</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="mt-4 space-y-2">
            <FormLabel>Mata pelajaran *</FormLabel>
            <div className="flex flex-wrap gap-2">
              {subjects.map((s) => (
                <Chip
                  key={s.id}
                  selected={subjectIds.includes(s.id)}
                  onClick={() => toggleSubject(s.id)}
                >
                  {s.name}
                </Chip>
              ))}
            </div>
            {form.formState.errors.subject_ids && (
              <p className="text-sm font-medium text-destructive">
                {form.formState.errors.subject_ids.message}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">SISTEM PEMBAYARAN</h2>
          <FormField
            control={form.control}
            name="billing_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sistem pembayaran</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(BILLING_TYPES).map(([value, label]) => (
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

          {billingType === "package" && (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="package_sessions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jumlah pertemuan *</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="12" inputMode="numeric" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="package_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Harga paket *</FormLabel>
                    <FormControl>
                      <Input placeholder="1.200.000" inputMode="numeric" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="package_start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal mulai *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {billingType === "monthly" && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="monthly_fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Biaya per bulan *</FormLabel>
                    <FormControl>
                      <Input placeholder="500.000" inputMode="numeric" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="monthly_due_day"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal jatuh tempo *</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="10" min={1} max={31} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </section>

        {!isEdit && (
          <>
            <section className="rounded-xl border bg-card p-5">
              <h2 className="mb-1 text-sm font-semibold text-muted-foreground">JADWAL</h2>
              <p className="mb-4 text-xs text-muted-foreground">
                Pilih hari dan jam mengajar. Paket → jadwal dibuat sebanyak jumlah pertemuan
                paket. Bulanan → jadwal dibuat pada hari terpilih sampai tanggal jatuh tempo.
                Jadwal dimulai dari tanggal mulai; pertemuan yang sudah lewat otomatis
                berstatus Selesai.
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <FormLabel>Hari mengajar</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {DAY_NAMES.map((name, i) => {
                      const day = i + 1;
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => toggleScheduleDay(day)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm transition-colors",
                            scheduleDays.includes(day)
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:border-primary/50 hover:text-primary"
                          )}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                  {form.formState.errors.schedule_days && (
                    <p className="text-sm font-medium text-destructive">
                      {form.formState.errors.schedule_days.message}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="schedule_start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tanggal mulai jadwal</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="schedule_start_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jam mulai</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="schedule_location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lokasi / link meeting</FormLabel>
                        <FormControl>
                          <Input placeholder="Rumah siswa / https://zoom.us/j/..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {typeof defaultDurationMinutes === "number" && (
                  <p className="text-xs text-muted-foreground">
                    Durasi pertemuan {defaultDurationMinutes} menit (diatur di Pengaturan).
                  </p>
                )}
              </div>
            </section>
          </>
        )}

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">CATATAN</h2>
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Catatan</FormLabel>
                <FormControl>
                  <Textarea rows={3} placeholder="Catatan khusus tentang siswa..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Batal
          </Button>
          <SubmitButton pending={pending} loadingText="Menyimpan...">
            {isEdit ? "Simpan Perubahan" : "Tambah Siswa"}
          </SubmitButton>
        </div>
      </form>
    </Form>
  );
}

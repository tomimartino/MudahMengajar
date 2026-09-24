"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { saveOnboardingAction } from "@/lib/actions/onboarding";
import { onboardingSchema, type OnboardingInput } from "@/lib/validations/onboarding";
import { DEFAULT_SUBJECTS, SCHOOL_LEVELS, TIMEZONES } from "@/lib/constants";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const STEPS = ["Identitas", "Pembelajaran", "Bimbel"];

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

export function OnboardingForm({
  initialFullName,
  initialWhatsapp,
  initialBusinessName,
  initialTimezone,
}: {
  initialFullName: string;
  initialWhatsapp: string;
  initialBusinessName: string;
  initialTimezone: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [customSubject, setCustomSubject] = useState("");

  const form = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema) as unknown as Resolver<OnboardingInput>,
    defaultValues: {
      full_name: initialFullName,
      whatsapp: initialWhatsapp,
      subjects: [],
      teaching_levels: [],
      business_name: initialBusinessName,
      timezone: initialTimezone,
    },
  });

  const subjects = form.watch("subjects");
  const levels = form.watch("teaching_levels");

  function toggleItem(
    key: "subjects" | "teaching_levels",
    item: string
  ) {
    const current = form.getValues(key);
    const next = current.includes(item)
      ? current.filter((v) => v !== item)
      : [...current, item];
    form.setValue(key, next, { shouldValidate: true });
  }

  function addCustomSubject() {
    const name = customSubject.trim();
    if (!name) return;
    if (!subjects.includes(name)) {
      form.setValue("subjects", [...subjects, name], { shouldValidate: true });
    }
    setCustomSubject("");
  }

  async function next() {
    try {
      const valid = await form.trigger(
        step === 0 ? ["full_name", "whatsapp"] : step === 1 ? ["subjects", "teaching_levels"] : undefined
      );
      if (valid) setStep((s) => s + 1);
    } catch {
      toast.error("Terjadi kesalahan. Silakan coba lagi.");
    }
  }

  async function onSubmit(values: OnboardingInput) {
    setPending(true);
    try {
      const result = await saveOnboardingAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Selamat datang di MudahMengajar!");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Logo className="justify-center" />
        <h1 className="text-center text-xl font-bold">Perkenalan singkat</h1>
        <p className="text-center text-sm text-muted-foreground">
          Langkah {step + 1} dari {STEPS.length}: {STEPS[step]}
        </p>
        <div className="mx-auto flex max-w-xs gap-2 pt-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")}
            />
          ))}
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {step === 0 && (
            <>
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama guru</FormLabel>
                    <FormControl>
                      <Input placeholder="Contoh: Ibu Sari" {...field} />
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
                      <Input placeholder="08xxxxxxxxxx" inputMode="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-2">
                <FormLabel>Mata pelajaran yang diajar</FormLabel>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_SUBJECTS.map((s) => (
                    <Chip
                      key={s}
                      selected={subjects.includes(s)}
                      onClick={() => toggleItem("subjects", s)}
                    >
                      {s}
                    </Chip>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Mapel lain..."
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
                {form.formState.errors.subjects && (
                  <p className="text-sm font-medium text-destructive">
                    {form.formState.errors.subjects.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <FormLabel>Jenjang yang diajar</FormLabel>
                <div className="flex flex-wrap gap-2">
                  {SCHOOL_LEVELS.map((s) => (
                    <Chip
                      key={s}
                      selected={levels.includes(s)}
                      onClick={() => toggleItem("teaching_levels", s)}
                    >
                      {s}
                    </Chip>
                  ))}
                </div>
                {form.formState.errors.teaching_levels && (
                  <p className="text-sm font-medium text-destructive">
                    {form.formState.errors.teaching_levels.message}
                  </p>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <FormField
                control={form.control}
                name="business_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama bimbel / usaha (opsional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Contoh: Bimbel Cerdas" {...field} />
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih zona waktu" />
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
            </>
          )}

          <div className="flex gap-2 pt-2">
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep((s) => s - 1)}
              >
                Kembali
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button type="button" className="flex-1" onClick={next}>
                Lanjut
              </Button>
            ) : (
              <SubmitButton pending={pending} className="flex-1" loadingText="Menyimpan...">
                Selesai
              </SubmitButton>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}

"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const THEMES = [
  { value: "light", label: "Terang", description: "Tampilan cerah.", icon: Sun },
  { value: "dark", label: "Gelap", description: "Tampilan redup.", icon: Moon },
  {
    value: "system",
    label: "Ikuti Sistem",
    description: "Sesuaikan dengan tema perangkat.",
    icon: Monitor,
  },
] as const;

function subscribe() {
  return () => {};
}

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  // Preferensi perangkat baru tersedia di browser, setelah hidrasi selesai.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <div className="space-y-3">
      <fieldset disabled={!mounted} aria-describedby="theme-description">
        <legend className="sr-only">Tema tampilan</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {THEMES.map(({ value, label, description, icon: Icon }) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border bg-muted/20 p-5 transition-colors hover:bg-accent/50 has-[:checked]:border-primary has-[:checked]:bg-mint has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <input
                type="radio"
                name="appearance-theme"
                value={value}
                checked={mounted && theme === value}
                onChange={() => setTheme(value)}
                className="size-4 shrink-0 accent-primary"
              />
              <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="space-y-1">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">{description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <p id="theme-description" className="text-sm text-muted-foreground">
        Pilihan diterapkan langsung dan disimpan di perangkat ini.
      </p>
    </div>
  );
}

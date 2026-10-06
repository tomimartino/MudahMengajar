"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const THEMES = [
  { value: "light", label: "Terang", icon: Sun },
  { value: "dark", label: "Gelap", icon: Moon },
  {
    value: "system",
    label: "Ikuti Sistem",
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
      <fieldset disabled={!mounted}>
        <legend className="sr-only">Tema tampilan</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {THEMES.map(({ value, label, icon: Icon }) => (
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
              <span className="text-sm font-medium">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

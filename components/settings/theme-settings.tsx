"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useAppearance } from "@/components/theme-provider";
import { StylePreview } from "@/components/settings/style-preview";
import { THEME_COLORS } from "@/lib/theme-colors";
import { THEME_STYLES } from "@/lib/theme-styles";

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
  const { themeColor, setThemeColor, themeStyle, setThemeStyle } = useAppearance();
  // Preferensi perangkat baru tersedia di browser, setelah hidrasi selesai.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <div className="space-y-6">
      <fieldset disabled={!mounted}>
        <legend className="mb-3 text-sm font-medium">Style</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {THEME_STYLES.map(({ value, label }) => (
            <label
              key={value}
              data-appearance-option
              className="cursor-pointer overflow-hidden rounded-2xl border bg-muted/20 p-2 transition-colors hover:bg-accent/50 has-[:checked]:border-primary has-[:checked]:bg-mint has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <StylePreview style={value} />
              <span className="flex items-center gap-2 px-1 pb-1 pt-3">
                <input
                  type="radio"
                  name="appearance-style"
                  value={value}
                  checked={mounted && themeStyle === value}
                  onChange={() => setThemeStyle(value)}
                  className="size-4 shrink-0 accent-primary"
                />
                <span className="text-sm font-medium">{label}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset disabled={!mounted}>
        <legend className="mb-3 text-sm font-medium">Mode</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <label
              key={value}
              data-appearance-option
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

      <fieldset disabled={!mounted}>
        <legend className="mb-3 text-sm font-medium">Warna</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {THEME_COLORS.map(({ value, label, swatch }) => (
            <label
              key={value}
              data-appearance-option
              className="flex cursor-pointer items-center gap-2 rounded-2xl border bg-muted/20 p-3 transition-colors hover:bg-accent/50 has-[:checked]:border-primary has-[:checked]:bg-mint has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring sm:gap-3 sm:p-4"
            >
              <input
                type="radio"
                name="appearance-color"
                value={value}
                checked={mounted && themeColor === value}
                onChange={() => setThemeColor(value)}
                className="sr-only"
              />
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: swatch }}
                aria-hidden="true"
              >
                <span className={`size-2 rounded-full bg-white ${mounted && themeColor === value ? "opacity-100" : "opacity-0"}`} />
              </span>
              <span className="text-sm font-medium">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

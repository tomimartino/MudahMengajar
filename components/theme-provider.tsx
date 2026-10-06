"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import {
  DEFAULT_THEME_COLOR,
  THEME_COLORS,
  THEME_COLOR_STORAGE_KEY,
  isThemeColor,
  type ThemeColor,
} from "@/lib/theme-colors";
import {
  DEFAULT_THEME_STYLE,
  THEME_STYLES,
  THEME_STYLE_STORAGE_KEY,
  isThemeStyle,
  type ThemeStyle,
} from "@/lib/theme-styles";

const AppearanceContext = createContext<{
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
  themeStyle: ThemeStyle;
  setThemeStyle: (style: ThemeStyle) => void;
} | null>(null);

function readThemeColor(): ThemeColor {
  if (typeof window === "undefined") return DEFAULT_THEME_COLOR;

  try {
    const saved = localStorage.getItem(THEME_COLOR_STORAGE_KEY);
    return isThemeColor(saved) ? saved : DEFAULT_THEME_COLOR;
  } catch {
    return DEFAULT_THEME_COLOR;
  }
}

function readThemeStyle(): ThemeStyle {
  if (typeof window === "undefined") return DEFAULT_THEME_STYLE;

  try {
    const saved = localStorage.getItem(THEME_STYLE_STORAGE_KEY);
    return isThemeStyle(saved) ? saved : DEFAULT_THEME_STYLE;
  } catch {
    return DEFAULT_THEME_STYLE;
  }
}

// Terapkan preferensi tersimpan sebelum halaman tampil, seperti skrip mode next-themes.
const appearanceScript = `(${(function (preferences: { key: string; attribute: string; fallback: string; values: string[] }[]) {
  for (const preference of preferences) {
    let value = preference.fallback;
    try {
      const saved = localStorage.getItem(preference.key);
      if (saved && preference.values.includes(saved)) value = saved;
    } catch {}
    document.documentElement.setAttribute(preference.attribute, value);
  }
}).toString()})(${JSON.stringify([
  { key: THEME_COLOR_STORAGE_KEY, attribute: "data-theme-color", fallback: DEFAULT_THEME_COLOR, values: THEME_COLORS.map(({ value }) => value) },
  { key: THEME_STYLE_STORAGE_KEY, attribute: "data-theme-style", fallback: DEFAULT_THEME_STYLE, values: THEME_STYLES.map(({ value }) => value) },
])});`;

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error("useAppearance must be used within ThemeProvider");
  return context;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeColor, updateThemeColor] = useState<ThemeColor>(readThemeColor);
  const [themeStyle, updateThemeStyle] = useState<ThemeStyle>(readThemeStyle);

  const setThemeColor = useCallback((color: ThemeColor) => {
    updateThemeColor(color);
    try {
      localStorage.setItem(THEME_COLOR_STORAGE_KEY, color);
    } catch {
      // Warna tetap bisa digunakan saat penyimpanan browser tidak tersedia.
    }
  }, []);

  const setThemeStyle = useCallback((style: ThemeStyle) => {
    updateThemeStyle(style);
    try {
      localStorage.setItem(THEME_STYLE_STORAGE_KEY, style);
    } catch {
      // Style tetap bisa digunakan saat penyimpanan browser tidak tersedia.
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme-color", themeColor);
    document.documentElement.setAttribute("data-theme-style", themeStyle);
  }, [themeColor, themeStyle]);

  useEffect(() => {
    function syncAppearance(event: StorageEvent) {
      if (event.key === THEME_COLOR_STORAGE_KEY || event.key === null) {
        updateThemeColor(isThemeColor(event.newValue) ? event.newValue : DEFAULT_THEME_COLOR);
      }
      if (event.key === THEME_STYLE_STORAGE_KEY || event.key === null) {
        updateThemeStyle(isThemeStyle(event.newValue) ? event.newValue : DEFAULT_THEME_STYLE);
      }
    }

    window.addEventListener("storage", syncAppearance);
    return () => window.removeEventListener("storage", syncAppearance);
  }, []);

  const appearanceContext = useMemo(
    () => ({ themeColor, setThemeColor, themeStyle, setThemeStyle }),
    [themeColor, setThemeColor, themeStyle, setThemeStyle]
  );

  return (
    <AppearanceContext.Provider value={appearanceContext}>
      <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: appearanceScript }} />
      <NextThemesProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
        storageKey="mudahmengajar-theme"
      >
        {children}
      </NextThemesProvider>
    </AppearanceContext.Provider>
  );
}

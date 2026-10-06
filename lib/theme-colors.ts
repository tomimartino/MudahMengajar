export const THEME_COLORS = [
  { value: "mint", label: "Mint", swatch: "#237f67" },
  { value: "blue", label: "Biru", swatch: "oklch(0.48 0.14 250)" },
  { value: "purple", label: "Ungu", swatch: "oklch(0.48 0.14 300)" },
  { value: "pink", label: "Merah muda", swatch: "oklch(0.48 0.14 355)" },
  { value: "orange", label: "Jingga", swatch: "oklch(0.48 0.14 55)" },
  { value: "slate", label: "Abu-abu", swatch: "oklch(0.48 0.02 250)" },
] as const;

export type ThemeColor = (typeof THEME_COLORS)[number]["value"];

export const DEFAULT_THEME_COLOR: ThemeColor = "mint";
export const THEME_COLOR_STORAGE_KEY = "mudahmengajar-theme-color";

export function isThemeColor(value: unknown): value is ThemeColor {
  return THEME_COLORS.some((color) => color.value === value);
}

export const THEME_STYLES = [
  { value: "standard", label: "Standar" },
  { value: "pixel", label: "Pixel" },
  { value: "playful", label: "Playful" },
  { value: "bento-grid", label: "Bento Grid" },
  { value: "hacker", label: "Hacker" },
] as const;

export type ThemeStyle = (typeof THEME_STYLES)[number]["value"];

export const DEFAULT_THEME_STYLE: ThemeStyle = "standard";
export const THEME_STYLE_STORAGE_KEY = "mudahmengajar-theme-style";

export function isThemeStyle(value: unknown): value is ThemeStyle {
  return THEME_STYLES.some((style) => style.value === value);
}

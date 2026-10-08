export function safeAuthNext(path: string | null | undefined, fallback = "/dashboard") {
  if (!path?.startsWith("/") || path.startsWith("//") || /[\\\r\n]/.test(path)) return fallback;
  return path;
}

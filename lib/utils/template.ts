/** Render template pesan dengan placeholder {{nama_placeholder}}. */
export function renderTemplate(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = vars[key];
    return value !== undefined && value !== null && value !== "" ? String(value) : match;
  });
}

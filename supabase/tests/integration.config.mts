import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["supabase/tests/*_api.test.ts"], testTimeout: 60000, hookTimeout: 60000 },
  resolve: { alias: { "@": path.resolve(process.cwd()) } },
});

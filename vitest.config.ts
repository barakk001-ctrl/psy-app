import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  // Components are .tsx with tsconfig "jsx: preserve" (Next compiles them);
  // tests that render a PDF document need the JSX compiled here
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Income/expense documents are hidden in production (src/lib/features.ts).
    // Every suite runs with them on, so their code keeps being tested;
    // documents-switch.test.ts turns them off to test the hiding itself.
    env: { DOCUMENTS_ENABLED: "true" },
  },
});

import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Standalone config for the thesis benchmark harness. Kept separate from the
// app's vitest config so the harness never counts against the app's per-file
// coverage gate.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["bench/**/*.test.ts"],
  },
});

import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Pure-logic unit tests run in the Node environment (no jsdom needed). The `@`
// alias mirrors tsconfig's paths so tests import modules the same way the app
// does. Add jsdom + a setup file later if component tests are introduced.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});

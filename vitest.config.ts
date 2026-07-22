import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: [
      "test/**/*.test.ts",
      "src/**/*.test.ts",
      "packages/*/test/**/*.test.ts",
      "packages/*/src/**/*.test.ts",
      "apps/*/test/**/*.test.ts",
      "apps/*/src/**/*.test.ts",
    ],
  },
});

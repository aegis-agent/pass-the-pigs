import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.{mjs,jsx}"],
    setupFiles: ["./test/setup.js"],
    environment: "jsdom",
    coverage: {
      provider: "v8",
      include: ["src/{engine,App}.{js,jsx}"],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.mjs'],
    coverage: {
      provider: 'v8',
      include: ['src/engine.js'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 }
    }
  }
});

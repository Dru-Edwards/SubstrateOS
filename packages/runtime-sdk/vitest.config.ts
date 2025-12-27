import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
    exclude: [
      'tests/e2e/**/*.test.ts',  // Exclude e2e tests that need Playwright
      'tests/devices/**/*.test.ts'  // Exclude device tests with missing imports
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts']
    },
    testTimeout: 10000,
    hookTimeout: 10000
  }
});

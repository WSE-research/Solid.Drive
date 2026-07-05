import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: "./src/test-setup.ts",
    testTimeout: 15000,
    pool: 'forks',
    maxWorkers: 4,
    include: [
      "src/**/*.test.ts", 
      "src/**/*.test.tsx", 
      "tests/integration/**/*.test.ts", 
      "tests/integration/**/*.test.tsx"],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        perFile: true,
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
      exclude: [
        "scripts/**",
        "dist/**",
        "dev-dist/**",
        "src/main.tsx",
        "src/types/**",
        "**/tboxTypes-file/tboxTypes.ts",
        "src/**/*-test/**",
        "src/**/test-setup.ts",
        "src/.ldo/**",
        "**/*.d.ts",
        "**/*.config.*",
        "node_modules/**",
        "src/**/index.ts",
        "**/icons-file/icons.ts",
        "**/*.css",
        "src/assets/**",
        // e2e/ has its own test runner (Playwright) and isn't measured by vitest.
        "e2e/**",
        // Playwright report and trace artifacts.
        "playwright-report/**",
        "test-results/**",
        "coverage/**",
        "public/sw.js",
      ],
    },
  },
}))

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: "./tests/setup.ts",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000, // kB — suppress advisory for large vendor bundles
  },
  optimizeDeps: {
    force: true,
    include: [
      'cross-fetch',
      'rdf-string',
      'buffer',
      '@ldo/ldo',
      '@ldo/solid',
      '@ldo/solid-react',
    ],
  },
  define: {
    global: 'globalThis',
  },
})
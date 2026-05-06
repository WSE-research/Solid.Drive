import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [react()],
  // VS Code atomic saves (write temp + rename) confuse the default chokidar
  // watcher on Windows, so HMR appears to "miss" edits. Polling makes the
  // watcher reliable at the cost of a small CPU bump during `vite`. Setting
  // `VITE_NO_POLLING=1` opts out (e.g. for users on macOS/Linux who prefer
  // event-based watching).
  server: {
    watch: {
      usePolling: process.env.VITE_NO_POLLING !== '1',
      interval: 200,
    },
  },
  build: {
    chunkSizeWarningLimit: 1000, // kB — suppress advisory for large vendor bundles
  },
  // `include` pre-bundles the listed CommonJS / deep dependency entries so
  // browser ESM imports don't re-trigger discovery mid-session — without
  // `force: true`, which would re-bundle on every start and cause spurious
  // full-page reloads that masquerade as broken HMR.
  optimizeDeps: {
    include: [
      'cross-fetch',
      'rdf-string',
      'buffer',
      '@ldo/ldo',
      '@ldo/solid',
      '@ldo/solid-react',
      'uuid',
    ],
  },
  define: {
    global: 'globalThis',
  },
})
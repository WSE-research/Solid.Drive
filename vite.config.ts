import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  // Served behind the WSE reverse proxy under this path prefix; emitted
  // asset and entry URLs must include it so requests land back on the
  // same location block in nginx.conf.
  base: '/solid-hello-world-frontend-react/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
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
      'uuid',
    ],
  },
  define: {
    global: 'globalThis',
  },
})
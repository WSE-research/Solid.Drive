import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

const BASE_PATH = '/solid-hello-world-frontend-react/'

// start_url and scope are derived from BASE_PATH so the installed app
// launches at the same location the reverse proxy serves and the service
// worker only claims pages under that prefix.
const pwaManifest = {
  name: 'Solid.drive',
  short_name: 'Solid.drive',
  description: 'A file manager for your Solid Pod.',
  start_url: BASE_PATH,
  scope: BASE_PATH,
  display: 'standalone' as const,
  theme_color: '#070738',
  background_color: '#0e0e10',
  icons: [
    { src: 'icons/pwa-192x192-v2.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/pwa-512x512-v2.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/maskable-512x512-v2.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}

// React Router writes query-only navigations onto whatever pathname the
// browser is currently at. When that pathname is the basename without a
// trailing slash (which happens after some OIDC redirect bounces and on
// other normalisation paths), the resulting URL is
// `/solid-hello-world-frontend-react?folder=...` and Vite's dev server
// 404s it because `base` requires the trailing slash. This plugin
// redirects the slash-less form back to the slash form so a manual
// refresh works.
const redirectBaseTrailingSlash = (): Plugin => ({
  name: 'redirect-base-trailing-slash',
  configureServer(server) {
    const prefix = BASE_PATH.slice(0, -1)
    server.middlewares.use((req, res, next) => {
      const rawUrl = req.url ?? ''
      const [pathname, query] = rawUrl.split('?')
      if (pathname === prefix) {
        const target = query ? `${BASE_PATH}?${query}` : BASE_PATH
        res.writeHead(302, { Location: target })
        res.end()
        return
      }
      next()
    })
  },
})

export default defineConfig({
  // Served behind the WSE reverse proxy under this path prefix; emitted
  // asset and entry URLs must include it so requests land back on the
  // same location block in nginx.conf.
  base: BASE_PATH,
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [
    react(),
    redirectBaseTrailingSlash(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icons/apple-touch-icon-180x180-v2.png'],
      manifest: pwaManifest,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 4_000_000,
        navigateFallback: `${BASE_PATH}index.html`,
      },
      devOptions: {
        enabled: false,
        type: 'module',
        suppressWarnings: true,
      },
    }),
  ],
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
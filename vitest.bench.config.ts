import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// The benchmark harness (bench/) is not part of the app's vitest run. Its unit
// tests live here so `npm run test:bench` exercises them without pulling bench
// files into the app's coverage gates. Node environment: these are server-side,
// no DOM.
export default mergeConfig(viteConfig, defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ["bench/**/*.test.ts"],
    testTimeout: 15000,
    pool: 'forks',
  },
}))

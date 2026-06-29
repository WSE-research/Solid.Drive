/**
 * Registers the vite-plugin-pwa service worker at startup.
 * `virtual:pwa-register` resolves the correct, BASE_URL-aware worker URL.
 * New versions activate silently via `registerType: 'autoUpdate'` in `vite.config.ts`.
 *
 * @packageDocumentation
 */

import { registerSW } from 'virtual:pwa-register';

/**
 * Call once from the app entry point. No-op in browsers without service-worker support.
 *
 * @public
 */
export const registerServiceWorker = (): void => {
  registerSW({ immediate: true });
};

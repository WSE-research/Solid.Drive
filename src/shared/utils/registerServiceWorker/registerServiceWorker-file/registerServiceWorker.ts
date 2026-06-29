/**
 * Registers the app's service worker under the configured BASE_URL.
 *
 * Called once from the application entry point. Both the worker script
 * URL and the registration scope are derived from {@link ENV.baseUrl}
 * so the worker controls exactly the pages served under Vite's `base`
 * (e.g. `/solid-hello-world-frontend-react/`) and nothing above it.
 *
 * @packageDocumentation
 */

import { ENV } from '@/config';

/**
 * Registers `${BASE_URL}sw.js` scoped to `${BASE_URL}`.
 *
 * A no-op that resolves to `undefined` when the runtime has no
 * `serviceWorker` support (e.g. older browsers, the jsdom test
 * environment) or when registration fails, so callers never have to
 * guard the call themselves.
 *
 * @returns The registration, or `undefined` when unavailable/failed.
 * @public
 */
export const registerServiceWorker = async (): Promise<
  ServiceWorkerRegistration | undefined
> => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return undefined;
  }

  try {
    return await navigator.serviceWorker.register(`${ENV.baseUrl}sw.js`, {
      scope: ENV.baseUrl,
    });
  } catch (error) {
    // A failed registration must never break app start-up.
    console.error('Service worker registration failed', error);
    return undefined;
  }
};

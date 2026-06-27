/**
 * Environment variable access layer.
 *
 * @remarks
 * All `import.meta.env` reads are centralized here. Components and services
 * must import from this module, never read `import.meta.env` directly.
 *
 * @packageDocumentation
 */

/**
 * Application environment variables.
 *
 * @public
 */
export const ENV = {
  /** Current build mode (e.g., "development", "production"). */
  mode: import.meta.env.MODE as string,
  /** True if running in development mode. */
  dev: import.meta.env.DEV as boolean,
  /** True if running in production mode. */
  prod: import.meta.env.PROD as boolean,
  /**
   * Public base path the app is served from, as configured by Vite's
   * `base` (e.g. `/solid-hello-world-frontend-react/`). Always ends with
   * a trailing slash. Used to resolve runtime-fetched assets such as the
   * service worker so they land under the same path prefix.
   */
  baseUrl: import.meta.env.BASE_URL as string,
} as const;

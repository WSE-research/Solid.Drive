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
 * Default transfer concurrency for the bulk upload queue when nothing is
 * configured.
 *
 * @public
 */
export const UPLOAD_CONCURRENCY_DEFAULT = 4;

/**
 * Parses an environment value as a positive integer, falling back to
 * {@link UPLOAD_CONCURRENCY_DEFAULT}.
 *
 * Never throws: env vars arrive as strings and may be absent, and a typo in a
 * deployment's environment must not stop the app from starting.
 */
function parseConcurrency(raw: unknown): number {
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : UPLOAD_CONCURRENCY_DEFAULT;
}

/**
 * Application environment variables.
 *
 * @public
 */
export const ENV = {
  /** Current build mode. */
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
  /**
   * How many file transfers the bulk upload queue may run at once.
   *
   * Overridable so performance experiments can sweep the value without a code
   * change — `SolidPodServerPerformanceAnalysis` varies it as the "number of
   * Solid.Drive threads". Unset, malformed or non-positive values fall back to
   * {@link UPLOAD_CONCURRENCY_DEFAULT}.
   */
  uploadConcurrency: parseConcurrency(import.meta.env.VITE_UPLOAD_CONCURRENCY),
} as const;

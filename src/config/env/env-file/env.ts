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
  /** Current build mode. */
  mode: import.meta.env.MODE as string,
  /** True if running in development mode. */
  dev: import.meta.env.DEV as boolean,
  /** True if running in production mode. */
  prod: import.meta.env.PROD as boolean,
  /** Base URL path the app is served under. */
  baseUrl: import.meta.env.BASE_URL as string,
} as const;

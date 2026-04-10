/**
 * App-level configuration read from Vite environment variables.
 * Override via a .env file or by setting VITE_* variables before the build.
 */

/** Container path (relative to the storage root) where the app stores files. */
export const APP_CONTAINER_PATH: string =
  import.meta.env.VITE_APP_CONTAINER_PATH ?? "my-solid-app/";

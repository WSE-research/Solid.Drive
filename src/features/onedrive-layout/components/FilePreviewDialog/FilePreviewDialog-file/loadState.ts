/**
 * Load-state union shared by the preview dialog and its body. Split
 * out so the dialog owns the fetch lifecycle while the body owns the
 * rendering branch, and they meet at a stable contract.
 *
 * @packageDocumentation
 */

/**
 * Lifecycle states for the binary backing the preview.
 *
 * @public
 */
export type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; objectUrl: string }
  | { status: 'error'; reason: string };

/** Fallback reason used when the binary fetch throws something that is not an Error. */
export const UNKNOWN_ERROR_REASON = 'Unknown error';

export const IDLE_STATE: LoadState = { status: 'idle' };
export const LOADING_STATE: LoadState = { status: 'loading' };

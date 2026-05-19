/**
 * Global pub/sub for shared-catalog invalidation. A single counter
 * rather than a per-URI map: every consumer subscribes to the same
 * signal, and a single notify wakes them all. This matches the usage
 * pattern (focus refresh, login warmup), which always invalidates
 * every contact's cached shared catalog at once.
 *
 * @packageDocumentation
 */

import { useSyncExternalStore } from 'react';
import { createGlobalVersionStore } from '@/shared/utils/createVersionStore';

const store = createGlobalVersionStore();

/**
 * Bump the global shared-catalog version and wake every subscriber.
 *
 * @public
 */
export const notifySharedCatalogsChanged = store.notify;

/**
 * Subscribe to the global shared-catalog version.
 *
 * @public
 */
export function useSharedCatalogVersion(): number {
  return useSyncExternalStore(store.subscribe, store.getVersion, () => 0);
}

/**
 * @internal
 */
export const __resetSharedCatalogVersionForTests = store.reset;

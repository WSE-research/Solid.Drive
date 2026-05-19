/**
 * Pub/sub for catalog mutations. Uploads and deletes patch
 * `catalog.ttl` via raw SPARQL through `solidFetch`, bypassing LDO
 * entirely, so `useCatalog`'s resource subscription only sees the
 * change if the pod happens to push a websocket notification. Writers
 * call {@link notifyCatalogChanged}; readers use the counter from
 * {@link useCatalogVersion} as a cache key or `useEffect` dep.
 *
 * @packageDocumentation
 */

import { useSyncExternalStore } from 'react';
import { createPerKeyVersionStore } from '@/shared/utils/createVersionStore';

const store = createPerKeyVersionStore();

/**
 * Bump the version for a catalog URI and wake every subscribed hook.
 *
 * @public
 */
export const notifyCatalogChanged = store.notify;

/**
 * Subscribe to catalog-change notifications for a single URI.
 *
 * @public
 */
export function useCatalogVersion(uri: string | undefined): number {
  return useSyncExternalStore(
    store.subscribe,
    () => (uri ? store.getVersion(uri) : 0),
    () => 0,
  );
}

/**
 * @internal
 */
export const __resetCatalogVersionsForTests = store.reset;

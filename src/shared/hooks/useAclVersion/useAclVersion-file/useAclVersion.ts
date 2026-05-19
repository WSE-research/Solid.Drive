/**
 * Pub/sub for ACL changes. After SharePanel writes a new ACL, every
 * other hook reading that resource (DetailPanel's HasAccess row, the
 * file-table Sharing cell, ...) needs to re-fetch. Writers call
 * {@link notifyAclChanged}; readers use the counter from
 * {@link useAclVersion} as a `useEffect` dep.
 *
 * @packageDocumentation
 */

import { useSyncExternalStore } from 'react';
import { createPerKeyVersionStore } from '@/shared/utils/createVersionStore';

const store = createPerKeyVersionStore();

/**
 * Bump the version for a URI and wake every subscribed hook. Call
 * after a successful ACL write.
 *
 * @public
 */
export const notifyAclChanged = store.notify;

/**
 * Subscribe to ACL-change notifications for a single URI.
 *
 * @public
 */
export function useAclVersion(uri: string | undefined): number {
  return useSyncExternalStore(
    store.subscribe,
    () => (uri ? store.getVersion(uri) : 0),
    () => 0,
  );
}

/**
 * @internal
 */
export const __resetAclVersionsForTests = store.reset;

/**
 * Module-level pub/sub for ACL changes. After SharePanel writes a new
 * ACL, every other hook reading that resource (DetailPanel's HasAccess
 * row, the file-table Sharing cell, ...) needs to re-fetch. Writers
 * call {@link notifyAclChanged}; readers subscribe via
 * {@link useAclVersion} and use the returned counter as a `useEffect`
 * dependency to re-run.
 *
 * @packageDocumentation
 */

import { useSyncExternalStore } from 'react';

const versionByUri = new Map<string, number>();
const listeners = new Set<() => void>();

function getVersion(uri: string | undefined): number {
  if (!uri) return 0;
  return versionByUri.get(uri) ?? 0;
}

/**
 * Bump the version for a URI and wake every subscribed hook. Call
 * after a successful ACL write.
 *
 * @public
 */
export function notifyAclChanged(uri: string): void {
  versionByUri.set(uri, getVersion(uri) + 1);
  for (const listener of listeners) listener();
}

/**
 * Subscribe to ACL-change notifications for a single URI. Use the
 * returned counter as a `useEffect` dep to re-run on change.
 *
 * @public
 */
export function useAclVersion(uri: string | undefined): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => getVersion(uri),
    () => 0,
  );
}

/**
 * Test-only helper that wipes the in-memory state.
 *
 * @internal
 */
export function __resetAclVersionsForTests(): void {
  versionByUri.clear();
  listeners.clear();
}

/**
 * Factory for the cache-invalidation pub/sub used by `useAclVersion`,
 * `useCatalogVersion`, and `useSharedCatalogVersion`. Each consumer
 * module owns a single store and exposes thin, well-named wrappers
 * over its primitives.
 *
 * @packageDocumentation
 */

/**
 * Primitives a version store exposes. Modules wrap these into their
 * domain-named hooks and notifiers.
 *
 * @public
 */
export interface VersionStore<K> {
  notify: (key: K) => void;
  subscribe: (listener: () => void) => () => void;
  getVersion: (key: K) => number;
  reset: () => void;
}

function createListenerSet(): {
  subscribe: (listener: () => void) => () => void;
  fire: () => void;
  clear: () => void;
} {
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    fire() {
      for (const listener of listeners) listener();
    },
    clear() {
      listeners.clear();
    },
  };
}

/**
 * Per-key version store. Each key has its own counter, so a notify on
 * key A only affects subscribers reading key A.
 *
 * @public
 */
export function createPerKeyVersionStore(): VersionStore<string> {
  const versionByKey = new Map<string, number>();
  const listeners = createListenerSet();

  return {
    notify(key) {
      versionByKey.set(key, (versionByKey.get(key) ?? 0) + 1);
      listeners.fire();
    },
    subscribe: listeners.subscribe,
    getVersion(key) {
      return versionByKey.get(key) ?? 0;
    },
    reset() {
      versionByKey.clear();
      listeners.clear();
    },
  };
}

/**
 * Global version store. A single counter. Every consumer reads the
 * same value, and every notify wakes every subscriber.
 *
 * @public
 */
export function createGlobalVersionStore(): VersionStore<void> {
  let version = 0;
  const listeners = createListenerSet();

  return {
    notify() {
      version += 1;
      listeners.fire();
    },
    subscribe: listeners.subscribe,
    getVersion() {
      return version;
    },
    reset() {
      version = 0;
      listeners.clear();
    },
  };
}

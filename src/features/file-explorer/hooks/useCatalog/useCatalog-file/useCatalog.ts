/**
 * Fetches and parses the user's DCAT catalog into typed entries.
 *
 * @packageDocumentation
 */

import { useEffect, useMemo, useState } from "react";
import { useResource, useSolidAuth } from "@ldo/solid-react";
import { parseCatalog } from "@/infrastructure/solid/catalog";
import { toContainerUri } from "@/infrastructure/solid/sharedCatalog";
import { useCatalogVersion } from "@/shared/hooks/useCatalogVersion";
import type { CatalogEntry } from "@/types";

interface UseCatalogReturn {
  entries: CatalogEntry[];
  containerUris: Set<string>;
  loading: boolean;
  error: Error | null;
}

interface CatalogCacheEntry {
  signal: unknown;
  entries: CatalogEntry[];
  containerUris: Set<string>;
}

// Module-level cache. Both `OneDriveLayout` and `MyFilesView` call
// `useCatalog` for the same `catalogUri` on every render of the My Files
// view, which used to mean two parallel pod fetches + two TTL parses per
// load. The cache keys on (uri, updateSignal) so a pod-pushed update
// still invalidates and re-fetches.
const catalogCache = new Map<string, CatalogCacheEntry>();
const catalogInflight = new Map<string, Promise<CatalogCacheEntry>>();

/**
 * Fetches the catalog at `catalogUri`, parses it into `CatalogEntry[]`,
 * and pre-computes the set of container URIs for downstream folder routing.
 *
 * @remarks
 * Re-fetches when `catalogUri` changes. Silently ignores fetch/parse errors
 * (exposes them via `error` for callers that want to surface them).
 *
 * @param catalogUri - URI of the DCAT catalog Turtle document
 *
 * @public
 */
export function useCatalog(catalogUri: string | undefined): UseCatalogReturn {
  const { fetch: solidFetch } = useSolidAuth();
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Subscribe to the catalog so pod-pushed notifications flip the
  // resource status and the parse effect below re-runs. The subscription
  // is opportunistic: not every pod implements notifications, and
  // mutations issued as raw SPARQL PATCH never reach LDO. The version
  // pub/sub below is the reliable signal; this is a best-effort speedup
  // when the pod does push updates.
  const catalogResource = useResource(catalogUri, {
    subscribe: true,
    suppressInitialRead: true,
  });
  const updateSignal = catalogResource?.status;

  // In-app signal for catalog mutations. Writers call notifyCatalogChanged
  // after a successful PATCH and the version bump invalidates the cache.
  const catalogVersion = useCatalogVersion(catalogUri);

  useEffect(() => {
    if (!catalogUri) {
      setEntries([]);
      setError(null);
      setLoading(false);
      return;
    }

    const signalKey = `${String(updateSignal)}@${catalogVersion}`;
    const cached = catalogCache.get(catalogUri);
    if (cached && cached.signal === signalKey) {
      setEntries(cached.entries);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const inflightKey = `${catalogUri}#${signalKey}`;
    let promise = catalogInflight.get(inflightKey);
    if (!promise) {
      promise = (async () => {
        try {
          const response = await solidFetch(catalogUri);
          if (!response.ok) {
            const empty: CatalogCacheEntry = {
              signal: signalKey,
              entries: [],
              containerUris: new Set(),
            };
            catalogCache.set(catalogUri, empty);
            return empty;
          }
          const text = await response.text();
          const parsed = parseCatalog(text, catalogUri);
          const entry: CatalogCacheEntry = {
            signal: signalKey,
            entries: parsed,
            containerUris: new Set(parsed.map((e) => toContainerUri(e.uri))),
          };
          catalogCache.set(catalogUri, entry);
          return entry;
        } finally {
          catalogInflight.delete(inflightKey);
        }
      })();
      catalogInflight.set(inflightKey, promise);
    }

    void promise.then(
      (result) => {
        if (cancelled) return;
        setEntries(result.entries);
        setLoading(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        setEntries([]);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      },
    );

    return () => { cancelled = true; };
  }, [catalogUri, solidFetch, updateSignal, catalogVersion]);

  const containerUris = useMemo(() => {
    if (!catalogUri) return new Set<string>();
    const cached = catalogCache.get(catalogUri);
    if (cached && cached.entries === entries) return cached.containerUris;
    return new Set(entries.map((entry) => toContainerUri(entry.uri)));
  }, [entries, catalogUri]);

  return { entries, containerUris, loading, error };
}

/**
 * Test-only helper that wipes the module cache.
 *
 * @internal
 */
export function __resetCatalogCacheForTests(): void {
  catalogCache.clear();
  catalogInflight.clear();
}

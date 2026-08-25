/**
 * Fetches and parses the user's DCAT catalog into typed entries.
 *
 * @packageDocumentation
 */

import { useEffect, useMemo, useState } from "react";
import { useResource, useSolidAuth } from "@ldo/solid-react";
import { isFolderEntry, parseCatalog } from "@/infrastructure/solid/catalog";
import { toContainerUri } from "@/infrastructure/solid/sharedCatalog";
import { useCatalogVersion } from "@/shared/hooks/useCatalogVersion";
import type { CatalogEntry, FolderIndex, FolderNode } from "@/types";

interface UseCatalogReturn {
  entries: CatalogEntry[];
  containerUris: Set<string>;
  // Maps container URI to the folder's catalog title.
  folderTitles: Map<string, string>;
  // Every folder in the catalog, keyed by container URI, for walking hasParent chains.
  folderIndex: FolderIndex;
  loading: boolean;
  error: Error | null;
}

interface CatalogCacheEntry {
  signal: unknown;
  entries: CatalogEntry[];
  containerUris: Set<string>;
  folderIndex: FolderIndex;
}

const EMPTY_RESULT: Omit<CatalogCacheEntry, "signal"> = {
  entries: [],
  containerUris: new Set(),
  folderIndex: new Map(),
};

// Splits parsed catalog entries into files and folders.
function partitionEntries(parsed: CatalogEntry[]): { fileEntries: CatalogEntry[]; folderEntries: CatalogEntry[] } {
  const fileEntries: CatalogEntry[] = [];
  const folderEntries: CatalogEntry[] = [];
  for (const entry of parsed) {
    (isFolderEntry(entry) ? folderEntries : fileEntries).push(entry);
  }
  return { fileEntries, folderEntries };
}

// Indexes folder entries by container URI so a hasParent walk needs no extra fetches.
function buildFolderIndex(folderEntries: CatalogEntry[]): FolderIndex {
  const index = new Map<string, FolderNode>();
  for (const entry of folderEntries) {
    const uri = toContainerUri(entry.uri);
    index.set(uri, { uri, title: entry.title, parentUri: entry.parentUri ?? "", conformsTo: entry.conformsTo });
  }
  return index;
}

// Derives the container-URI-to-title map straight from the folder index, so
// there is one source of truth for folder titles.
function folderTitlesFrom(folderIndex: FolderIndex): Map<string, string> {
  return new Map([...folderIndex].map(([uri, node]) => [uri, node.title]));
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
  const [folderIndex, setFolderIndex] = useState<FolderIndex>(new Map());
  const [error, setError] = useState<Error | null>(null);
  const [settledAttemptKey, setSettledAttemptKey] = useState<string | undefined>(undefined);

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

  // Read the cache; the effect below skips fetching when it's already fresh.
  const signalKey = catalogUri ? `${String(updateSignal)}@${catalogVersion}` : undefined;
  // Includes the catalog URI so two catalogs with the same signal aren't mixed up.
  const attemptKey = catalogUri ? `${catalogUri}#${signalKey}` : undefined;
  const cached = catalogUri ? catalogCache.get(catalogUri) : undefined;
  const hasFreshCache = !!cached && cached.signal === signalKey;
  const isSettled = hasFreshCache || (!!attemptKey && settledAttemptKey === attemptKey);
  const loading = !!catalogUri && !isSettled;

  useEffect(() => {
    if (!catalogUri || hasFreshCache || !attemptKey) return;

    let cancelled = false;

    let promise = catalogInflight.get(attemptKey);
    if (!promise) {
      promise = (async () => {
        try {
          const response = await solidFetch(catalogUri);
          if (!response.ok) {
            const empty: CatalogCacheEntry = { signal: signalKey, ...EMPTY_RESULT };
            catalogCache.set(catalogUri, empty);
            return empty;
          }
          const text = await response.text();
          const { fileEntries, folderEntries } = partitionEntries(parseCatalog(text, catalogUri));
          const entry: CatalogCacheEntry = {
            signal: signalKey,
            entries: fileEntries,
            containerUris: new Set(fileEntries.map((e) => toContainerUri(e.uri))),
            folderIndex: buildFolderIndex(folderEntries),
          };
          catalogCache.set(catalogUri, entry);
          return entry;
        } finally {
          catalogInflight.delete(attemptKey);
        }
      })();
      catalogInflight.set(attemptKey, promise);
    }

    void promise.then(
      (result) => {
        if (cancelled) return;
        setSettledAttemptKey(attemptKey);
        setEntries(result.entries);
        setFolderIndex(result.folderIndex);
        setError(null);
      },
      (err: unknown) => {
        if (cancelled) return;
        setSettledAttemptKey(attemptKey);
        setEntries(EMPTY_RESULT.entries);
        setFolderIndex(EMPTY_RESULT.folderIndex);
        setError(err instanceof Error ? err : new Error(String(err)));
      },
    );

    return () => { cancelled = true; };
  }, [catalogUri, solidFetch, updateSignal, catalogVersion, hasFreshCache, attemptKey, signalKey]);

  // Pick the effective source once (cache vs. freshly-settled state) so
  // the derived views below are computed from it a single time, instead
  // of once here and again, redundantly, inside the cache-hit branch.
  // Prefer the cache whenever it exists, fresh or stale, so a background
  // re-fetch doesn't blank out folder titles that are still correct.
  const effectiveFolderIndex = cached ? cached.folderIndex : folderIndex;
  const folderTitles = useMemo(() => folderTitlesFrom(effectiveFolderIndex), [effectiveFolderIndex]);
  const containerUris = useMemo(
    () => (cached ? cached.containerUris : new Set(entries.map((entry) => toContainerUri(entry.uri)))),
    [cached, entries]
  );

  // No catalog to read.
  if (!catalogUri) {
    return { ...EMPTY_RESULT, folderTitles: new Map(), loading: false, error: null };
  }

  // Cached, whether fresh or awaiting a background re-fetch: serve it
  // directly instead of waiting for the effect.
  if (cached) {
    return {
      entries: cached.entries,
      containerUris,
      folderTitles,
      folderIndex: effectiveFolderIndex,
      loading,
      error: null,
    };
  }

  // No cache yet for this catalog: nothing to show until the first fetch settles.
  if (!isSettled) {
    return { ...EMPTY_RESULT, folderTitles: new Map(), loading, error: null };
  }

  return { entries, containerUris, folderTitles, folderIndex, loading, error };
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

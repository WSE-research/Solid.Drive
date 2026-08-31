/**
 * Fetches and parses the user's DCAT catalog into typed entries.
 *
 * @packageDocumentation
 */

import { useEffect, useMemo, useState } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { isFolderEntry, parseCatalog } from "@/infrastructure/solid/catalog";
import { toContainerUri } from "@/infrastructure/solid/sharedCatalog";
import { useCatalogVersion } from "@/shared/hooks/useCatalogVersion";
import type { CatalogEntry, FolderIndex, FolderNode } from "@/types";

interface UseCatalogReturn {
  entries: CatalogEntry[];
  containerUris: Set<string>;
  // Container URI -> folder title.
  folderTitles: Map<string, string>;
  // Every folder in the catalog, keyed by container URI.
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

// Splits parsed entries into files and folders.
function partitionEntries(parsed: CatalogEntry[]): { fileEntries: CatalogEntry[]; folderEntries: CatalogEntry[] } {
  const fileEntries: CatalogEntry[] = [];
  const folderEntries: CatalogEntry[] = [];
  for (const entry of parsed) {
    (isFolderEntry(entry) ? folderEntries : fileEntries).push(entry);
  }
  return { fileEntries, folderEntries };
}

// Indexes folders by container URI, so walking a hasParent chain needs no extra fetches.
function buildFolderIndex(folderEntries: CatalogEntry[]): FolderIndex {
  const index = new Map<string, FolderNode>();
  for (const entry of folderEntries) {
    const uri = toContainerUri(entry.uri);
    index.set(uri, { uri, title: entry.title, parentUri: entry.parentUri ?? "", conformsTo: entry.conformsTo });
  }
  return index;
}

// Derives the title map from the folder index, so there's one source of truth.
function folderTitlesFrom(folderIndex: FolderIndex): Map<string, string> {
  return new Map([...folderIndex].map(([uri, node]) => [uri, node.title]));
}

// Shared across hook instances, so two views reading the same catalog fetch
// and parse it once instead of twice. Keyed on (uri, catalogVersion), so a
// confirmed write still invalidates it.
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
  // Which catalogUri the current entries/folderIndex belong to, so a
  // same-catalog refetch can keep serving them instead of going empty.
  const [entriesCatalogUri, setEntriesCatalogUri] = useState<string | undefined>(undefined);

  // Only catalogVersion triggers a refetch: writers call notifyCatalogChanged
  // after a confirmed write, a plain re-render never does. We used to also
  // key off the catalog resource's own live subscription, but @ldo/react
  // rewraps that resource on every pod notification, so it looked "changed"
  // almost constantly and caused near-continuous refetching.
  const catalogVersion = useCatalogVersion(catalogUri);

  const signalKey = catalogUri ? `${catalogVersion}` : undefined;
  // Includes the catalog URI so two catalogs with the same version aren't mixed up.
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
        setEntriesCatalogUri(catalogUri);
        setError(null);
      },
      (err: unknown) => {
        if (cancelled) return;
        setSettledAttemptKey(attemptKey);
        setEntries(EMPTY_RESULT.entries);
        setFolderIndex(EMPTY_RESULT.folderIndex);
        setEntriesCatalogUri(catalogUri);
        setError(err instanceof Error ? err : new Error(String(err)));
      },
    );

    return () => { cancelled = true; };
  }, [catalogUri, solidFetch, catalogVersion, hasFreshCache, attemptKey, signalKey]);

  // Computed once here so the branches below don't repeat the same check.
  const effectiveFolderIndex = hasFreshCache && cached ? cached.folderIndex : folderIndex;
  const folderTitles = useMemo(() => folderTitlesFrom(effectiveFolderIndex), [effectiveFolderIndex]);
  const containerUris = useMemo(
    () => (hasFreshCache && cached ? cached.containerUris : new Set(entries.map((entry) => toContainerUri(entry.uri)))),
    [hasFreshCache, cached, entries]
  );

  if (!catalogUri) {
    return { ...EMPTY_RESULT, folderTitles: new Map(), loading: false, error: null };
  }

  if (hasFreshCache && cached) {
    return {
      entries: cached.entries,
      containerUris,
      folderTitles,
      folderIndex: effectiveFolderIndex,
      loading,
      error: null,
    };
  }

  // Still fetching. If catalogUri itself changed we have no data for it yet,
  // so serve empty. Otherwise it's a refetch of the same catalog, so keep
  // serving its last-known entries instead of flashing empty.
  if (!isSettled) {
    if (entriesCatalogUri === catalogUri) {
      return { entries, containerUris, folderTitles, folderIndex, loading, error };
    }
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

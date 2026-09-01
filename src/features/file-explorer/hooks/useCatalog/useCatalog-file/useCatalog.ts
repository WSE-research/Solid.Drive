/**
 * Fetches and parses the user's DCAT catalog into typed entries.
 *
 * @packageDocumentation
 */

import { useEffect, useMemo, useState } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { isFolderEntry, parseCatalogRecovering } from "@/infrastructure/solid/catalog";
import { toContainerUri } from "@/infrastructure/solid/sharedCatalog";
import { useCatalogVersion } from "@/shared/hooks/useCatalogVersion";
import type { CatalogEntry, FolderIndex, FolderNode } from "@/types";

interface UseCatalogReturn {
  entries: CatalogEntry[];
  // The same folders as folderIndex, but as full CatalogEntry rows rather
  // than the trimmed FolderNode shape, for a caller like useTrashEntries
  // that needs every field (not just uri/title/parentUri) and has no use
  // for the files/folders split, since the trash catalog is flat.
  folderEntries: CatalogEntry[];
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
  folderEntries: CatalogEntry[];
  containerUris: Set<string>;
  folderIndex: FolderIndex;
  // Set when the document needed truncating (or couldn't be read at all)
  // to parse. `entries` still holds whatever was recovered before that.
  parseError: Error | null;
}

const EMPTY_RESULT: Omit<CatalogCacheEntry, "signal"> = {
  entries: [],
  folderEntries: [],
  containerUris: new Set(),
  folderIndex: new Map(),
  parseError: null,
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
 * Loads the catalog at `catalogUri`, parses its entries, and builds the
 * container URI set used to decide how folders are shown.
 *
 * @remarks
 * Runs again when `catalogUri` changes. A non-2xx response is treated as
 * an empty catalog. If the fetch succeeds but the document is malformed,
 * any entries parsed before the error are still returned and `error` is set.
 *
 * @param catalogUri - URI of the DCAT catalog Turtle document
 *
 * @public
 */
export function useCatalog(catalogUri: string | undefined): UseCatalogReturn {
  const { fetch: solidFetch } = useSolidAuth();
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [folderEntries, setFolderEntries] = useState<CatalogEntry[]>([]);
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
          const { entries: parsedEntries, error: parseError } = parseCatalogRecovering(text, catalogUri);
          const { fileEntries, folderEntries } = partitionEntries(parsedEntries);
          const entry: CatalogCacheEntry = {
            signal: signalKey,
            entries: fileEntries,
            folderEntries,
            containerUris: new Set(fileEntries.map((e) => toContainerUri(e.uri))),
            folderIndex: buildFolderIndex(folderEntries),
            parseError,
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
        setFolderEntries(result.folderEntries);
        setFolderIndex(result.folderIndex);
        setEntriesCatalogUri(catalogUri);
        setError(result.parseError);
      },
      (err: unknown) => {
        if (cancelled) return;
        setSettledAttemptKey(attemptKey);
        setEntries(EMPTY_RESULT.entries);
        setFolderEntries(EMPTY_RESULT.folderEntries);
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
      folderEntries: cached.folderEntries,
      containerUris,
      folderTitles,
      folderIndex: effectiveFolderIndex,
      loading,
      error: cached.parseError,
    };
  }

  // Still fetching. If catalogUri itself changed we have no data for it yet,
  // so serve empty. Otherwise it's a refetch of the same catalog, so keep
  // serving its last-known entries instead of flashing empty.
  if (!isSettled) {
    if (entriesCatalogUri === catalogUri) {
      return { entries, folderEntries, containerUris, folderTitles, folderIndex, loading, error };
    }
    return { ...EMPTY_RESULT, folderTitles: new Map(), loading, error: null };
  }

  return { entries, folderEntries, containerUris, folderTitles, folderIndex, loading, error };
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

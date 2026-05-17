/**
 * Fetches and parses the user's DCAT catalog into typed entries.
 *
 * @packageDocumentation
 */

import { useEffect, useMemo, useState } from "react";
import { useResource, useSolidAuth } from "@ldo/solid-react";
import { parseCatalog } from "@/infrastructure/solid/catalog";
import { toContainerUri } from "@/infrastructure/solid/sharedCatalog";
import type { CatalogEntry } from "@/types";

interface UseCatalogReturn {
  entries: CatalogEntry[];
  containerUris: Set<string>;
  loading: boolean;
  error: Error | null;
}

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

  // Catalog mutations go through plain SPARQL PATCH, so LDO never knows
  // about them. Subscribe to the catalog resource so the pod's
  // notifications tell us when to re-fetch. The result of useResource
  // itself is unused; only its 'update' event matters.
  const catalogResource = useResource(catalogUri, {
    subscribe: true,
    suppressInitialRead: true,
  });

  // `status` changes whenever the resource is re-fetched, including on
  // server-pushed updates. Reading it here makes the parse effect below
  // depend on a value that changes on every update, which triggers a
  // re-fetch and a re-parse.
  const updateSignal = catalogResource?.status;

  useEffect(() => {
    if (!catalogUri) {
      setEntries([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const response = await solidFetch(catalogUri);
        if (cancelled) return;
        if (!response.ok) {
          setEntries([]);
          return;
        }
        const text = await response.text();
        if (cancelled) return;
        setEntries(parseCatalog(text, catalogUri));
      } catch (err) {
        if (cancelled) return;
        setEntries([]);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [catalogUri, solidFetch, updateSignal]);

  const containerUris = useMemo(
    () => new Set(entries.map((entry) => toContainerUri(entry.uri))),
    [entries]
  );

  return { entries, containerUris, loading, error };
}

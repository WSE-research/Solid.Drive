/**
 * @packageDocumentation
 * Fetches shared catalog entries from a contact's Pod.
 */

import { useState, useEffect, useMemo } from "react";
import { useSolidAuth, useResource, useSubject } from "@ldo/solid-react";
import { SolidProfileShapeType } from "@/.ldo/solidProfile.shapeTypes";
import { parseCatalog } from "@/infrastructure/solid/catalog";
import { isVisibleResourceUri } from "@/features/file-explorer/services/fileFilter";
import { getAppContainerUri, getCandidateSharedCatalogUris, hasAccess } from "@/infrastructure/solid/sharedCatalog";
import { useSharedCatalogVersion } from "@/shared/hooks/useSharedCatalogVersion";
import { DEFAULT_FILE_TYPE_URI, DEFAULT_CATALOG_FILENAME } from "@/config";
import type { CatalogEntry } from "@/types";

interface UseSharedCatalogReturn {
  sharedEntries: CatalogEntry[];
  grantedEntries: CatalogEntry[];
  typeGroups: Map<string, CatalogEntry[]>;
  resolvedCatalogUri: string | null;
  catalogAccessible: boolean;
  isProfileLoading: boolean;
}

interface ResolvedSharedCatalog {
  sharedEntries: CatalogEntry[];
  grantedEntries: CatalogEntry[];
  typeGroups: Map<string, CatalogEntry[]>;
  resolvedCatalogUri: string | null;
  catalogAccessible: boolean;
}

const EMPTY_RESOLVED: ResolvedSharedCatalog = {
  sharedEntries: [],
  grantedEntries: [],
  typeGroups: new Map(),
  resolvedCatalogUri: null,
  catalogAccessible: false,
};

// Module-level cache. `SharedFilesTable` calls `useSharedCatalog` once
// per contact, and `ContactSharedFiles` may render the same contact
// alongside it in the People view, so two consumers can hit the same
// (host, target) pair simultaneously. Without the cache, each consumer
// re-runs the full fetch chain (per-viewer probe → main catalog fetch →
// N hasAccess checks) from scratch.
const sharedCatalogCache = new Map<string, ResolvedSharedCatalog>();
const sharedCatalogInflight = new Map<string, Promise<ResolvedSharedCatalog>>();

type SolidFetch = typeof fetch;

function cacheKey(
  catalogUris: string[],
  mainCatalogUri: string | null,
  version: number,
): string {
  return `${catalogUris.join("|")}::${mainCatalogUri ?? ""}#v${version}`;
}

function parseVisibleCatalog(turtleText: string, baseUri: string): CatalogEntry[] {
  return parseCatalog(turtleText, baseUri).filter((entry) => isVisibleResourceUri(entry.uri));
}

function bucketByClass(entries: CatalogEntry[]): Map<string, CatalogEntry[]> {
  const groups = new Map<string, CatalogEntry[]>();
  for (const entry of entries) {
    const key = entry.conformsTo || DEFAULT_FILE_TYPE_URI;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return groups;
}

async function loadSharedCatalog(
  catalogUris: string[],
  mainCatalogUri: string | null,
  solidFetch: SolidFetch,
): Promise<ResolvedSharedCatalog> {
  let foundShared: CatalogEntry[] = [];
  let foundCatalogUri: string | null = null;
  let perContactAccessible = false;

  for (const catalogUri of catalogUris) {
    try {
      const response = await solidFetch(catalogUri);
      if (!response.ok) continue;
      const text = await response.text();
      const parsed = parseVisibleCatalog(text, catalogUri);
      perContactAccessible = true;
      if (parsed.length > 0) {
        foundShared = parsed;
        foundCatalogUri = catalogUri;
        break;
      }
    } catch {
      // try next
    }
  }

  if (perContactAccessible) {
    const perViewerChecks = await Promise.all(
      foundShared.map(async (entry) => ({
        entry,
        accessible: await hasAccess(entry.uri, solidFetch),
      })),
    );

    const accessibleShared: CatalogEntry[] = [];
    const browsable: CatalogEntry[] = [];
    for (const { entry, accessible } of perViewerChecks) {
      if (accessible) accessibleShared.push(entry);
      else browsable.push(entry);
    }

    const extraAccessible: CatalogEntry[] = [];
    if (mainCatalogUri) {
      try {
        const mainResponse = await solidFetch(mainCatalogUri);
        if (mainResponse.ok) {
          const mainText = await mainResponse.text();
          const allMainEntries = parseVisibleCatalog(mainText, mainCatalogUri);
          const sharedUris = new Set(foundShared.map((entry) => entry.uri));
          const notYetShared = allMainEntries.filter((entry) => !sharedUris.has(entry.uri));

          const accessChecks = await Promise.all(
            notYetShared.map(async (entry) => ({
              entry,
              accessible: await hasAccess(entry.uri, solidFetch),
            })),
          );

          for (const { entry, accessible } of accessChecks) {
            if (accessible) extraAccessible.push(entry);
            else browsable.push(entry);
          }
        }
      } catch {
        // silently ignore
      }
    }

    return {
      sharedEntries: [...accessibleShared, ...extraAccessible],
      grantedEntries: foundShared,
      typeGroups: bucketByClass(browsable),
      resolvedCatalogUri: foundCatalogUri,
      catalogAccessible: true,
    };
  }

  if (mainCatalogUri) {
    try {
      const response = await solidFetch(mainCatalogUri);
      if (response.ok) {
        const text = await response.text();
        const parsed = parseVisibleCatalog(text, mainCatalogUri);
        if (parsed.length > 0) {
          const accessChecks = await Promise.all(
            parsed.map(async (entry) => ({
              entry,
              accessible: await hasAccess(entry.uri, solidFetch),
            })),
          );

          const accessible = accessChecks.filter((c) => c.accessible).map((c) => c.entry);
          const browsable = accessChecks.filter((c) => !c.accessible).map((c) => c.entry);

          return {
            sharedEntries: accessible,
            grantedEntries: [],
            typeGroups: bucketByClass(browsable),
            resolvedCatalogUri: mainCatalogUri,
            catalogAccessible: true,
          };
        }
      }
    } catch {
      // not accessible
    }
  }

  return EMPTY_RESOLVED;
}

/**
 * Resolves which files a contact has shared with the current user.
 *
 * @remarks
 * Tries per-viewer shared catalogs first, then falls back to the
 * contact's main catalog and probes file accessibility.
 *
 * @param contactWebId - WebID of the contact whose files to view
 * @param viewerWebId - WebID of the current user
 *
 * @public
 */
export function useSharedCatalog(contactWebId: string, viewerWebId: string): UseSharedCatalogReturn {
  const { fetch: solidFetch } = useSolidAuth();
  const profileDocUri = contactWebId.split("#")[0];
  const profileResource = useResource(profileDocUri);
  const profile = useSubject(SolidProfileShapeType, contactWebId);

  const isProfileLoading = !!(profileResource && "isLoading" in profileResource && (profileResource as { isLoading: () => boolean }).isLoading());

  const storageRoot =
    profile?.storage?.toArray()?.[0]?.["@id"] ??
    profileDocUri.replace(/\/profile\/card$/, "/");

  const catalogUris = useMemo(
    () => storageRoot ? getCandidateSharedCatalogUris(getAppContainerUri(storageRoot), viewerWebId) : [],
    [storageRoot, viewerWebId]
  );
  const mainCatalogUri = profile?.catalog?.["@id"] ?? (storageRoot ? `${storageRoot}${DEFAULT_CATALOG_FILENAME}` : null);

  const [resolved, setResolved] = useState<ResolvedSharedCatalog>(EMPTY_RESOLVED);

  // Global invalidation signal. Bumped by `notifySharedCatalogsChanged`
  // (focus refresh, manual invalidation). Folded into the cache key so a
  // bump becomes a cache miss across every consumer in one shot.
  const sharedCatalogVersion = useSharedCatalogVersion();

  useEffect(() => {
    if (catalogUris.length === 0 && !mainCatalogUri) return;

    const key = cacheKey(catalogUris, mainCatalogUri, sharedCatalogVersion);
    const cached = sharedCatalogCache.get(key);
    if (cached) {
      setResolved(cached);
      return;
    }

    let cancelled = false;

    let promise = sharedCatalogInflight.get(key);
    if (!promise) {
      promise = (async () => {
        try {
          const result = await loadSharedCatalog(catalogUris, mainCatalogUri, solidFetch);
          sharedCatalogCache.set(key, result);
          return result;
        } finally {
          sharedCatalogInflight.delete(key);
        }
      })();
      sharedCatalogInflight.set(key, promise);
    }

    void promise.then((result) => {
      if (!cancelled) setResolved(result);
    });

    return () => { cancelled = true; };
  }, [catalogUris, mainCatalogUri, solidFetch, sharedCatalogVersion]);

  return {
    sharedEntries: resolved.sharedEntries,
    grantedEntries: resolved.grantedEntries,
    typeGroups: resolved.typeGroups,
    resolvedCatalogUri: resolved.resolvedCatalogUri,
    catalogAccessible: resolved.catalogAccessible,
    isProfileLoading,
  };
}

/**
 * Test-only helper that wipes the module cache.
 *
 * @internal
 */
export function __resetSharedCatalogCacheForTests(): void {
  sharedCatalogCache.clear();
  sharedCatalogInflight.clear();
}

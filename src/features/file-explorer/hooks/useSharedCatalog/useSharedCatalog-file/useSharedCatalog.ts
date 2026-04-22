/**
 * @packageDocumentation
 * Fetches shared catalog entries from a contact's Pod.
 */

import { useState, useEffect, useMemo } from "react";
import { useSolidAuth, useResource, useSubject } from "@ldo/solid-react";
import { SolidProfileShapeType } from "@/.ldo/solidProfile.shapeTypes";
import { parseCatalog } from "@/infrastructure/solid/catalog";
import { getAppContainerUri, getCandidateSharedCatalogUris, toContainerUri, hasAccess } from "@/infrastructure/solid/sharedCatalog";
import { DEFAULT_FILE_TYPE_URI } from "@/config";
import type { CatalogEntry } from "@/types";

interface UseSharedCatalogReturn {
  sharedEntries: CatalogEntry[];
  typeGroups: Map<string, CatalogEntry[]>;
  resolvedCatalogUri: string | null;
  catalogAccessible: boolean;
  isProfileLoading: boolean;
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
  const mainCatalogUri = profile?.catalog?.["@id"] ?? (storageRoot ? `${storageRoot}catalog.ttl` : null);

  const [sharedEntries, setSharedEntries] = useState<CatalogEntry[]>([]);
  const [resolvedCatalogUri, setResolvedCatalogUri] = useState<string | null>(null);
  const [typeGroups, setTypeGroups] = useState<Map<string, CatalogEntry[]>>(new Map());
  const [catalogAccessible, setCatalogAccessible] = useState(false);

  useEffect(() => {
    if (catalogUris.length === 0 && !mainCatalogUri) return;
    let cancelled = false;

    void (async () => {
      let foundShared: CatalogEntry[] = [];
      let foundCatalogUri: string | null = null;
      let perContactAccessible = false;

      for (const catalogUri of catalogUris) {
        try {
          const response = await solidFetch(catalogUri);
          if (!response.ok) continue;
          const text = await response.text();
          const parsed = parseCatalog(text, catalogUri);
          if (cancelled) return;
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

      /* v8 ignore next 2 */
      if (cancelled) return;

      if (perContactAccessible) {
        setCatalogAccessible(true);
        setSharedEntries(foundShared);
        setResolvedCatalogUri(foundCatalogUri);

        if (mainCatalogUri) {
          try {
            const mainResponse = await solidFetch(mainCatalogUri);
            if (mainResponse.ok) {
              const mainText = await mainResponse.text();
              const allMainEntries = parseCatalog(mainText, mainCatalogUri);
              const sharedUris = new Set(foundShared.map((entry) => entry.uri));
              const notYetShared = allMainEntries.filter((entry) => !sharedUris.has(entry.uri));

              const accessChecks = await Promise.all(
                notYetShared.map(async (entry) => ({
                  entry,
                  accessible: await hasAccess(toContainerUri(entry.uri), solidFetch),
                }))
              );

              if (cancelled) return;

              const recoveredShared: CatalogEntry[] = [];
              const browsable: CatalogEntry[] = [];

              for (const { entry, accessible } of accessChecks) {
                if (accessible) recoveredShared.push(entry);
                else browsable.push(entry);
              }

              if (recoveredShared.length > 0) {
                setSharedEntries((prev) => [...prev, ...recoveredShared]);
              }

              const groups = new Map<string, CatalogEntry[]>();
              for (const entry of browsable) {
                const key = entry.conformsTo || DEFAULT_FILE_TYPE_URI;
                const existing = groups.get(key) ?? [];
                groups.set(key, [...existing, entry]);
              }
              setTypeGroups(groups);
            }
          } catch {
            // silently ignore
          }
        }
        return;
      }

      if (mainCatalogUri) {
        try {
          const response = await solidFetch(mainCatalogUri);
          if (response.ok) {
            const text = await response.text();
            const parsed = parseCatalog(text, mainCatalogUri);
            if (cancelled) return;
            if (parsed.length > 0) {
              const accessChecks = await Promise.all(
                parsed.map(async (entry) => ({
                  entry,
                  accessible: await hasAccess(toContainerUri(entry.uri), solidFetch),
                }))
              );
              if (cancelled) return;

              const accessible = accessChecks.filter((c) => c.accessible).map((c) => c.entry);
              const browsable = accessChecks.filter((c) => !c.accessible).map((c) => c.entry);

              setSharedEntries(accessible);
              setResolvedCatalogUri(mainCatalogUri);
              setCatalogAccessible(true);

              if (browsable.length > 0) {
                const groups = new Map<string, CatalogEntry[]>();
                for (const entry of browsable) {
                  const key = entry.conformsTo || DEFAULT_FILE_TYPE_URI;
                  const existing = groups.get(key) ?? [];
                  groups.set(key, [...existing, entry]);
                }
                setTypeGroups(groups);
              }
              return;
            }
          }
        } catch {
          // not accessible
        }
      }

      if (!cancelled) {
        setSharedEntries([]);
        setTypeGroups(new Map());
        setResolvedCatalogUri(null);
        setCatalogAccessible(false);
      }
    })();

    return () => { cancelled = true; };
  }, [catalogUris, mainCatalogUri, solidFetch]);

  return { sharedEntries, typeGroups, resolvedCatalogUri, catalogAccessible, isProfileLoading };
}

/**
 * @packageDocumentation
 * Resolves a user's catalog and the current folder's breadcrumb trail
 * together, since every consumer needs both and builds them the same way.
 */

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { resolveCatalogUri } from "@/infrastructure/solid/catalog";
import { useCatalog } from "@/features/file-explorer/hooks/useCatalog";
import { useCatalogRootEntry } from "@/features/file-explorer/hooks/useCatalogRootEntry";
import { useFolderBreadcrumbs } from "@/features/file-explorer/hooks/useFolderBreadcrumbs";
import { useNotifications } from "@/shared/contexts/NotificationContext";
import type { SolidProfile } from "@/.ldo/solidProfile.typings";
import type { Breadcrumb } from "@/features/file-explorer/hooks/useNavigation";
import type { CatalogEntry } from "@/types";

interface UseCatalogBreadcrumbsParams {
  /** The user's Solid profile, used to resolve the catalog address. */
  profile: SolidProfile | undefined | null;
  /** The pod's storage root, where every breadcrumb trail ends. */
  storageRootUri: string | undefined;
  /** Container the breadcrumb trail is built for. */
  currentUri: string | undefined;
  /** Label for the root breadcrumb when the root's own catalog entry has no title. */
  rootLabel: string;
}

interface UseCatalogBreadcrumbsReturn {
  catalogUri: string | undefined;
  /** True once the profile links directly to a catalog, so a caller knows whether to link one after its own writes. */
  profileHasCatalog: boolean;
  catalogEntries: CatalogEntry[];
  catalogContainerUris: Set<string>;
  /** Every folder's catalog title, keyed by container URI. */
  folderTitles: Map<string, string>;
  /** Fully-labeled breadcrumb trail for `currentUri`, root-first. */
  breadcrumbs: Breadcrumb[];
}

/**
 * Resolves the catalog for `profile`/`storageRootUri`, registers the
 * storage root's own catalog entry, and builds `currentUri`'s breadcrumb
 * trail from the result.
 *
 * @remarks
 * Bundles {@link resolveCatalogUri}, {@link useCatalogRootEntry},
 * {@link useCatalog}, and {@link useFolderBreadcrumbs} because every
 * catalog-backed view needs all four together, in this order, with no
 * view-specific variation between them. It also owns the toast shown when
 * a folder has a catalog entry but a broken hasParent chain, so that
 * doesn't have to be duplicated at each call site either.
 *
 * @public
 */
export function useCatalogBreadcrumbs({
  profile,
  storageRootUri,
  currentUri,
  rootLabel,
}: UseCatalogBreadcrumbsParams): UseCatalogBreadcrumbsReturn {
  const [translate] = useTranslation();
  const { showError } = useNotifications();

  const catalogUri = resolveCatalogUri(profile, storageRootUri);
  const profileHasCatalog = !!profile?.catalog?.["@id"];

  const { entries, containerUris, folderTitles, folderIndex, loading } = useCatalog(catalogUri);

  const rootAlreadyPresent = !loading && !!storageRootUri && folderIndex.has(storageRootUri);
  const rootEntryStatus = useCatalogRootEntry(catalogUri, storageRootUri, rootAlreadyPresent);

  const { breadcrumbs, error: breadcrumbError } = useFolderBreadcrumbs({
    currentUri,
    storageRootUri,
    rootLabel,
    folderIndex,
    rootEntryFailed: rootEntryStatus === "failed",
  });

  // A folder that has a catalog entry but a broken sd:hasParent chain is a
  // data defect, not something to fail silently on: surface it so the user
  // knows the breadcrumb trail shown is incomplete.
  useEffect(() => {
    if (!breadcrumbError) return;
    showError(translate("fileExplorer.brokenFolderPath", { folder: breadcrumbError.atUri }));
  }, [breadcrumbError, showError, translate]);

  return {
    catalogUri,
    profileHasCatalog,
    catalogEntries: entries,
    catalogContainerUris: containerUris,
    folderTitles,
    breadcrumbs,
  };
}

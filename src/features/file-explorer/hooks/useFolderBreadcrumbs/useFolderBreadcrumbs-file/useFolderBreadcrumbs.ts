/**
 * @packageDocumentation
 * Builds the current folder's breadcrumb trail by walking sd:hasParent
 * links, instead of splitting the folder's URI.
 */

import { useMemo } from "react";
import type { SolidContainerUri } from "@ldo/connected-solid";
import { buildFolderPath, FolderPathError } from "@/features/file-explorer/services/folderPath";
import { buildDriveBreadcrumbs } from "@/features/file-explorer/services/driveUrl";
import type { Breadcrumb } from "@/features/file-explorer/hooks/useNavigation";
import type { FolderIndex } from "@/types";

interface UseFolderBreadcrumbsParams {
  /** Container the breadcrumb trail is built for. */
  currentUri: string | undefined;
  /** The pod's storage root, where every trail ends. */
  storageRootUri: string | undefined;
  /** Label for the root crumb when the root's own catalog entry has no title. */
  rootLabel: string;
  /** Every folder in the catalog, keyed by container URI. */
  folderIndex: FolderIndex;
  /** True once the storage root's own registration write has confirmed failed. See {@link useCatalogRootEntry}. */
  rootEntryFailed: boolean;
}

interface UseFolderBreadcrumbsReturn {
  breadcrumbs: Breadcrumb[];
  error: FolderPathError | null;
}

/**
 * Builds `currentUri`'s breadcrumb trail by walking `sd:hasParent` links in
 * `folderIndex` up to `storageRootUri`.
 *
 * @remarks
 * A folder missing from the catalog entirely falls back to splitting its
 * URI. A folder that's in the catalog with a broken hasParent chain sets
 * `error` and falls back to just the root crumb. The storage root is an
 * exception: its entry is written on a separate round trip, so a missing
 * root is treated as a startup race, not a broken chain, until
 * `rootEntryFailed` confirms that write itself failed.
 *
 * @public
 */
export function useFolderBreadcrumbs({
  currentUri,
  storageRootUri,
  rootLabel,
  folderIndex,
  rootEntryFailed,
}: UseFolderBreadcrumbsParams): UseFolderBreadcrumbsReturn {
  return useMemo(() => {
    if (!currentUri || !storageRootUri) {
      return { breadcrumbs: [], error: null };
    }

    if (!folderIndex.has(currentUri)) {
      return { breadcrumbs: buildDriveBreadcrumbs(currentUri, storageRootUri, rootLabel, folderIndex), error: null };
    }

    try {
      return { breadcrumbs: buildFolderPath(currentUri, folderIndex, storageRootUri, rootLabel), error: null };
    } catch (error) {
      if (!(error instanceof FolderPathError)) throw error;
      if (error.reason === "missing-entry" && error.atUri === storageRootUri && !rootEntryFailed) {
        return { breadcrumbs: buildDriveBreadcrumbs(currentUri, storageRootUri, rootLabel, folderIndex), error: null };
      }
      return {
        breadcrumbs: [{ label: rootLabel, uri: storageRootUri as SolidContainerUri }],
        error,
      };
    }
  }, [currentUri, storageRootUri, rootLabel, folderIndex, rootEntryFailed]);
}

/**
 * React hook for creating new folders (LDP BasicContainers) on Solid pods.
 *
 * @remarks
 * Provides folder name validation, container creation via the LDP protocol,
 * and catalog registration so the folder has an addressable, titled entry.
 *
 * @packageDocumentation
 */

import { useState, useCallback } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { appendFolderToCatalog, linkCatalogToProfile } from "@/infrastructure/solid/catalog";
import { notifyCatalogChanged } from "@/shared/hooks/useCatalogVersion";
import type { ContainerCreationResult } from "@/types";
import type { SolidContainer, SolidContainerUri } from "@ldo/connected-solid";

/** Characters that are not allowed in folder names. */
const INVALID_CHARS_REGEX = /[/\\:*?"<>|]/;

/**
 * Validates a folder name and returns an i18n error key, or null if valid.
 *
 * @param name - The proposed folder name (may contain surrounding whitespace).
 * @returns An i18n key string if invalid, or null if the name is acceptable.
 *
 * @public
 */
export function validateFolderName(folderName: string): string | null {
  const trimmedFolderName = folderName.trim();
  if (trimmedFolderName.length === 0) {
    return "fileExplorer.newFolderEmpty";
  }
  if (INVALID_CHARS_REGEX.test(trimmedFolderName)) {
    return "fileExplorer.newFolderInvalidChars";
  }
  return null;
}

/**
 * Parameters for creating a folder.
 *
 * @public
 */
interface CreateFolderParams {
  /** Container the new folder is created under. */
  parentContainer: SolidContainer;
  /** Name the user typed; saved as both the slug source and the catalog title. */
  folderName: string;
  /** URI of the catalog to register the folder in. */
  catalogUri: string;
  /** Whether the profile already links to the catalog. */
  profileHasCatalog: boolean;
}

/**
 * Return value from the useCreateFolder hook.
 *
 * @public
 */
interface UseCreateFolderReturn {
  /** True while the container creation request is in progress. */
  isCreating: boolean;
  /** Creates a new child container and registers it in the catalog. */
  createFolder: (params: CreateFolderParams) => Promise<string>;
  /** Validates a folder name; delegates to validateFolderName. */
  validateName: (folderName: string) => string | null;
}

/**
 * Hook for creating new folders as LDP BasicContainers on a Solid pod.
 *
 * @remarks
 * The caller is responsible for validating the name with validateName before
 * calling createFolder. No validation is performed inside createFolder itself.
 * Registers the folder in the catalog so it has an addressable, titled entry;
 * if the catalog write fails, the container is removed so no orphaned folder
 * is left behind.
 *
 * @returns Object with isCreating flag, createFolder function, and validateName function.
 *
 * @public
 */
export function useCreateFolder(): UseCreateFolderReturn {
  const { session, fetch: solidFetch } = useSolidAuth();
  const [isCreating, setIsCreating] = useState(false);

  const createFolder = useCallback(async ({
    parentContainer,
    folderName,
    catalogUri,
    profileHasCatalog,
  }: CreateFolderParams): Promise<string> => {
    if (!session.webId) throw new Error("Not logged in");
    const title = folderName.trim();
    const containerSlug = (title.toLowerCase().replace(/[^a-z0-9-]+/g, "-") + "/") as SolidContainerUri;
    setIsCreating(true);
    try {
      const creationResult = await parentContainer.createChildAndOverwrite(containerSlug) as ContainerCreationResult;
      if (creationResult.isError) {
        throw new Error(creationResult.message);
      }
      const folderUri = `${parentContainer.uri}${containerSlug}`;

      try {
        await appendFolderToCatalog(catalogUri, folderUri, title, new Date().toISOString(), session.webId, solidFetch);
      } catch (catalogErr) {
        await solidFetch(folderUri, { method: "DELETE" }).catch(() => {});
        throw new Error(`Catalog could not be updated. ${(catalogErr as Error).message}`, { cause: catalogErr });
      }

      if (!profileHasCatalog) {
        await linkCatalogToProfile(catalogUri, session.webId, solidFetch).catch(() => {});
      }

      // The catalog PATCH bypassed LDO, so push a local notification to
      // wake every useCatalog consumer immediately, without a manual refresh.
      notifyCatalogChanged(catalogUri);

      return folderUri;
    } finally {
      setIsCreating(false);
    }
  }, [session, solidFetch]);

  return { isCreating, createFolder, validateName: validateFolderName };
}

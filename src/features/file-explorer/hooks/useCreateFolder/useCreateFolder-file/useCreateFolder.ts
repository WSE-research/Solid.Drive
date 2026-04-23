/**
 * React hook for creating new folders (LDP BasicContainers) on Solid pods.
 *
 * @remarks
 * Provides folder name validation and container creation via the LDP protocol.
 *
 * @packageDocumentation
 */

import { useState, useCallback } from "react";
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
 * Return value from the useCreateFolder hook.
 *
 * @public
 */
interface UseCreateFolderReturn {
  /** True while the container creation request is in progress. */
  isCreating: boolean;
  /** Creates a new child container under the given parent. */
  createFolder: (parentContainer: SolidContainer, folderName: string) => Promise<void>;
  /** Validates a folder name; delegates to validateFolderName. */
  validateName: (folderName: string) => string | null;
}

/**
 * Hook for creating new folders as LDP BasicContainers on a Solid pod.
 *
 * @remarks
 * The caller is responsible for validating the name with validateName before
 * calling createFolder. No validation is performed inside createFolder itself.
 *
 * @returns Object with isCreating flag, createFolder function, and validateName function.
 *
 * @public
 */
export function useCreateFolder(): UseCreateFolderReturn {
  const [isCreating, setIsCreating] = useState(false);

  const createFolder = useCallback(async (
    parentContainer: SolidContainer,
    folderName: string
  ): Promise<void> => {
    const containerSlug = (folderName.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-") + "/") as SolidContainerUri;
    setIsCreating(true);
    try {
      const creationResult = await parentContainer.createChildAndOverwrite(containerSlug) as ContainerCreationResult;
      if (creationResult.isError) {
        throw new Error(creationResult.message);
      }
    } finally {
      setIsCreating(false);
    }
  }, []);

  return { isCreating, createFolder, validateName: validateFolderName };
}

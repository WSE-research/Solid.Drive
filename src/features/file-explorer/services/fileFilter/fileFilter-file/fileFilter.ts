/**
 * File filtering utilities for the file explorer.
 *
 * @remarks
 * Filters out system files and shared catalog files from user views.
 *
 * @packageDocumentation
 */

import { isSharedCatalogFile } from "@/infrastructure/solid/sharedCatalog";
import { SYSTEM_FILES } from "@/config/constants";
import { getTrashContainerUri } from "@/infrastructure/solid/trashPaths";
import type { SolidContainer, SolidLeaf } from "@ldo/connected-solid";

/**
 * Checks if a resource URI should be shown to the user.
 *
 * @remarks
 * Filters out known system files and shared-catalog files. Works for any
 * resource URI, whether it comes from a container listing or a catalog entry.
 *
 * @param uri - The resource URI to check
 * @returns True if the resource should be visible
 *
 * @public
 */
export function isVisibleResourceUri(uri: string): boolean {
  const fileName = decodeURIComponent(uri.split("/").pop() ?? "");
  return !SYSTEM_FILES.has(fileName) && !isSharedCatalogFile(fileName);
}

/**
 * Checks if a leaf entry should be shown to the user.
 *
 * @param entry - The leaf resource to check
 * @returns True if the file should be visible
 *
 * @public
 */
export function isVisibleLeaf(entry: SolidLeaf): boolean {
  return isVisibleResourceUri(entry.uri);
}

/**
 * Checks whether a container URI should appear in the regular file browser.
 *
 * @remarks
 * Excludes the trash container itself (an exact match on the storage-root
 * trash path), which is exposed through the dedicated Recycle Bin view
 * rather than as a regular user folder. A user folder that happens to be
 * named "trash" elsewhere in the tree is unaffected.
 *
 * @param uri - The container URI to check
 * @param storageRootUri - The pod's storage root URI
 * @returns True if the container should be visible
 *
 * @public
 */
export function isVisibleContainerUri(uri: string, storageRootUri: string): boolean {
  const trim = (value: string) => (value.endsWith("/") ? value.slice(0, -1) : value);
  return trim(uri) !== trim(getTrashContainerUri(storageRootUri));
}

/**
 * Checks whether a container should appear in the regular file browser.
 *
 * @param entry - The container resource to check
 * @param storageRootUri - The pod's storage root URI
 * @returns True if the container should be visible
 *
 * @public
 */
export function isVisibleContainer(entry: SolidContainer, storageRootUri: string): boolean {
  return isVisibleContainerUri(entry.uri, storageRootUri);
}

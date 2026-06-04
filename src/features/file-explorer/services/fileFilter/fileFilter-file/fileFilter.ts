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
import type { SolidLeaf } from "@ldo/connected-solid";

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

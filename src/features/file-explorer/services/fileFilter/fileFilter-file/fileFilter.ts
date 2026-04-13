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
 * Checks if a leaf entry should be shown to the user.
 *
 * @remarks
 * Filters out known system files and shared-catalog files.
 *
 * @param entry - The leaf resource to check
 * @returns True if the file should be visible
 *
 * @public
 */
export function isVisibleLeaf(entry: SolidLeaf): boolean {
  const fileName = decodeURIComponent(entry.uri.split("/").pop() ?? "");
  return !SYSTEM_FILES.has(fileName) && !isSharedCatalogFile(fileName);
}

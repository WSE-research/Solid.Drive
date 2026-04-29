/**
 * @packageDocumentation
 * Helpers for per-contact shared catalog URIs and access checks.
 */

import type { FetchFn } from "@/types";
import { APP_CONTAINER_PATH, SHARED_CATALOG_PREFIX } from "@/config";

/**
 * Strips the fragment from a WebID to normalize it.
 *
 * @public
 */
export function normalizeShareCatalogId(webId: string): string {
  return webId.trim().split("#")[0];
}

/**
 * Returns the app container URI for a given storage root.
 *
 * @public
 */
export function getAppContainerUri(storageRoot: string): string {
  return `${storageRoot}${APP_CONTAINER_PATH}`;
}

/**
 * Builds the filename for a per-contact shared catalog.
 *
 * @public
 */
export function getSharedCatalogFileName(granteeWebId: string): string {
  return `${SHARED_CATALOG_PREFIX}${encodeURIComponent(normalizeShareCatalogId(granteeWebId))}.ttl`;
}

/**
 * Returns the full URI of a per-contact shared catalog.
 *
 * @public
 */
export function getSharedCatalogUri(appContainerUri: string, granteeWebId: string): string {
  return `${appContainerUri}${getSharedCatalogFileName(granteeWebId)}`;
}

/**
 * Returns both normalized and legacy catalog URIs for backward compatibility.
 *
 * @public
 */
export function getCandidateSharedCatalogUris(appContainerUri: string, granteeWebId: string): string[] {
  const rawId = granteeWebId.trim();
  const normalizedId = normalizeShareCatalogId(granteeWebId);
  const ids = rawId === normalizedId ? [normalizedId] : [normalizedId, rawId];
  return [...new Set(ids.map((id) => `${appContainerUri}${SHARED_CATALOG_PREFIX}${encodeURIComponent(id)}.ttl`))];
}

/**
 * Returns true if the filename matches the shared catalog pattern.
 *
 * @public
 */
export function isSharedCatalogFile(fileName: string): boolean {
  return fileName.startsWith(SHARED_CATALOG_PREFIX) && fileName.endsWith(".ttl");
}

/**
 * Converts a catalog entry URI to its parent container URI.
 *
 * @remarks
 * Handles three shapes the catalog can produce:
 * - `…/file/index.ttl` (current FileCard layout) → `…/file/`
 * - `…/file/binary.ext` (legacy entries that point straight at the binary) → `…/file/`
 * - `…/file/` (already a container) → unchanged
 *
 * @public
 */
export function toContainerUri(instanceUri: string): string {
  if (instanceUri.endsWith("/")) return instanceUri;
  const lastSlash = instanceUri.lastIndexOf("/");
  if (lastSlash === -1) return instanceUri;
  return instanceUri.slice(0, lastSlash + 1);
}

/**
 * Checks if the user can read a container.
 *
 * @public
 */
export async function hasAccess(containerUri: string, fetch: FetchFn): Promise<boolean> {
  try {
    const response = await fetch(containerUri, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

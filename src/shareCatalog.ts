export const APP_CONTAINER_PATH = "my-solid-app/";
const SHARED_CATALOG_PREFIX = ".shared-";

// Strip the fragment from a WebID to get the profile document URI
export function normalizeShareCatalogId(webId: string): string {
  return webId.trim().split("#")[0];
}

export function getAppContainerUri(storageRoot: string): string {
  return `${storageRoot}${APP_CONTAINER_PATH}`;
}

// Build the per-contact shared catalog filename
export function getSharedCatalogFileName(granteeWebId: string): string {
  return `${SHARED_CATALOG_PREFIX}${encodeURIComponent(normalizeShareCatalogId(granteeWebId))}.ttl`;
}

// Build the full URI of a per-contact shared catalog inside the app container
export function getSharedCatalogUri(appContainerUri: string, granteeWebId: string): string {
  return `${appContainerUri}${getSharedCatalogFileName(granteeWebId)}`;
}

/**
 * Returns both the normalized and legacy filename variants so we can read
 * catalogs created before WebID normalization was introduced.
 */
export function getCandidateSharedCatalogUris(appContainerUri: string, granteeWebId: string): string[] {
  const rawId = granteeWebId.trim();
  const normalizedId = normalizeShareCatalogId(granteeWebId);
  const ids = rawId === normalizedId ? [normalizedId] : [normalizedId, rawId];
  return [...new Set(ids.map((id) => `${appContainerUri}${SHARED_CATALOG_PREFIX}${encodeURIComponent(id)}.ttl`))];
}

// Returns true if the filename looks like a per-contact shared catalog (`.shared-*.ttl`)
export function isSharedCatalogFile(fileName: string): boolean {
  return fileName.startsWith(SHARED_CATALOG_PREFIX) && fileName.endsWith(".ttl");
}

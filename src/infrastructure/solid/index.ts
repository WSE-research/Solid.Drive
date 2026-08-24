/**
 * @packageDocumentation
 * Solid protocol infrastructure exports
 *
 * Provides utilities for working with Solid pods including resource guards,
 * profile management, catalog operations, and display name resolution.
 */

export { isLoadable, isReadable, isBinary, isDeletable, isReloadable, isSolidContainer, isSolidLeaf } from "./resourceGuards";
export { saveProfileFields, ensureProfileDocType, addContact, removeContact } from "./profile";
export type { ProfileFields } from "./profile";
export { resolveCatalogUri, appendToCatalog, appendFolderToCatalog, ensureCatalogRootEntry, isFolderEntry, FOLDER_CLASS_URI, LEGACY_FOLDER_CLASS_URI, removeFromCatalog, parseCatalog, linkCatalogToProfile, buildEmptyCatalogTurtle } from "./catalog";
export { getAppContainerUri, getSharedCatalogUri, getSharedCatalogFileName, getCandidateSharedCatalogUris, isSharedCatalogFile, normalizeShareCatalogId, toContainerUri, hasAccess } from "./sharedCatalog";
export { resolveDisplayName } from "./displayName";
export { discoverStorageRoot } from "./storageDiscovery";
// Re-export storage config for convenience
export { APP_CONTAINER_PATH, SHARED_CATALOG_PREFIX } from "@/config";

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
export { resolveCatalogUri, appendToCatalog, removeFromCatalog, parseCatalog, linkCatalogToProfile, EMPTY_CATALOG_TURTLE } from "./catalog";
export { getAppContainerUri, getSharedCatalogUri, getSharedCatalogFileName, getCandidateSharedCatalogUris, isSharedCatalogFile, normalizeShareCatalogId, toContainerUri, hasAccess } from "./sharedCatalog";
export { resolveDisplayName } from "./displayName";
// Re-export storage config for convenience
export { APP_CONTAINER_PATH, SHARED_CATALOG_PREFIX } from "@/config";

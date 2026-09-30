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
export { resolveCatalogUri, appendToCatalog, appendFolderToCatalog, ensureCatalogRootEntry, isFolderEntry, FOLDER_CLASS_URI, LEGACY_FOLDER_CLASS_URI, removeFromCatalog, parseCatalog, parseCatalogRecovering, linkCatalogToProfile, resourceFileName, buildEmptyCatalogTurtle } from "./catalog";
export type { ParseCatalogRecoveringResult } from "./catalog";
export { getAppContainerUri, getSharedCatalogUri, getSharedCatalogFileName, getCandidateSharedCatalogUris, isSharedCatalogFile, normalizeShareCatalogId, toContainerUri, hasAccess } from "./sharedCatalog";
export { resolveDisplayName } from "./displayName";
export { discoverStorageRoot } from "./storageDiscovery";
export {
  getTrashContainerUri,
  getTrashCatalogUri,
  getTrashItemContainerUri,
  getTrashPayloadUri,
  getTrashFolderPayloadContainerUri,
  getTrashCatalogSnapshotUri,
  getTombstoneUri,
  getAclSnapshotUri,
} from "./trashPaths";
export {
  buildTombstoneTurtle,
  parseTombstone,
  writeTombstone,
  readTombstone,
  computeExpiry,
  isExpired,
} from "./tombstone";
export type { Tombstone } from "./tombstone";
export { listContainerChildren } from "./containerListing";
export { copyResource, ensureContainer, copyContainerTree } from "./resourceCopy";
export { collectSubtreeCatalogEntries } from "./catalogSubtree";
export { readTrashCatalogSnapshot, summarizeTrashFolder, readTrashFolderContents, writeCatalogEntry } from "./catalogSnapshot";
export type { TrashFolderContents } from "./catalogSnapshot";
// Re-export storage config for convenience
export { APP_CONTAINER_PATH, SHARED_CATALOG_PREFIX } from "@/config";

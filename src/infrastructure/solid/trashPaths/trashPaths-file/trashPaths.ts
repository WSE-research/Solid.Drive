/**
 * @packageDocumentation
 * URI scheme for the trash container and its per-item resources:
 * `trash/catalog.ttl` at the pod storage root, and `trash/<id>/` per
 * soft-deleted item. A trashed file holds a fixed-name `payload`,
 * `index.ttl`, `acl-snapshot.ttl`, and `tombstone.ttl`; a trashed folder
 * holds a `payload/` container mirroring its original subtree plus a
 * `catalog-snapshot.ttl` in place of the single `index.ttl`.
 *
 * @remarks
 * Lives at the storage root rather than under the app container: it's a
 * pod-wide recycle bin, not scoped to this one app. See the README for why
 * the payload is renamed and why the container isn't dot-prefixed.
 */

import { DEFAULT_CATALOG_FILENAME, TRASH_ACL_SNAPSHOT_FILE, TRASH_CONTAINER_NAME, TRASH_CATALOG_SNAPSHOT_FILE, TRASH_FOLDER_PAYLOAD_CONTAINER_NAME, TRASH_PAYLOAD_FILE, TRASH_TOMBSTONE_FILE } from "@/config";

/**
 * Returns the trash container URI for a given pod storage root.
 *
 * @public
 */
export function getTrashContainerUri(storageRootUri: string): string {
  return `${storageRootUri}${TRASH_CONTAINER_NAME}`;
}

/**
 * Returns the trash catalog URI for a given pod storage root.
 *
 * @remarks
 * Deliberately reuses `DEFAULT_CATALOG_FILENAME` so the trash catalog can be
 * read and written with the exact same `appendToCatalog`/`removeFromCatalog`/
 * `parseCatalog` functions used for the main catalog.
 *
 * @public
 */
export function getTrashCatalogUri(storageRootUri: string): string {
  return `${getTrashContainerUri(storageRootUri)}${DEFAULT_CATALOG_FILENAME}`;
}

/**
 * Returns the container URI for a single trashed item.
 *
 * @public
 */
export function getTrashItemContainerUri(storageRootUri: string, trashItemId: string): string {
  return `${getTrashContainerUri(storageRootUri)}${trashItemId}/`;
}

/**
 * Returns the fixed-name payload URI for a trashed item's container.
 *
 * @public
 */
export function getTrashPayloadUri(trashItemContainerUri: string): string {
  return `${trashItemContainerUri}${TRASH_PAYLOAD_FILE}`;
}

/**
 * Returns the fixed-name payload container URI for a trashed folder,
 * mirroring its original subtree. The folder equivalent of
 * {@link getTrashPayloadUri}.
 *
 * @public
 */
export function getTrashFolderPayloadContainerUri(trashItemContainerUri: string): string {
  return `${trashItemContainerUri}${TRASH_FOLDER_PAYLOAD_CONTAINER_NAME}`;
}

/**
 * Returns the catalog snapshot URI for a trashed folder: a snapshot of
 * the catalog entries for the folder itself and everything it contained,
 * replayed into the original catalog on restore.
 *
 * @public
 */
export function getTrashCatalogSnapshotUri(trashItemContainerUri: string): string {
  return `${trashItemContainerUri}${TRASH_CATALOG_SNAPSHOT_FILE}`;
}

/**
 * Returns the tombstone URI for a trashed item's container.
 *
 * @public
 */
export function getTombstoneUri(trashItemContainerUri: string): string {
  return `${trashItemContainerUri}${TRASH_TOMBSTONE_FILE}`;
}

/**
 * Returns the ACL snapshot URI for a trashed item's container.
 *
 * @public
 */
export function getAclSnapshotUri(trashItemContainerUri: string): string {
  return `${trashItemContainerUri}${TRASH_ACL_SNAPSHOT_FILE}`;
}

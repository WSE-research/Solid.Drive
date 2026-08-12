/**
 * @packageDocumentation
 * URI scheme for the trash container and its per-item resources:
 * `trash/catalog.ttl` at the pod storage root, and `trash/<id>/` per
 * soft-deleted item holding a fixed-name `payload`, `index.ttl`,
 * `acl-snapshot.ttl`, and `tombstone.ttl`.
 *
 * @remarks
 * Lives at the storage root rather than under the app container: it's a
 * pod-wide recycle bin, not scoped to this one app. See the README for why
 * the payload is renamed and why the container isn't dot-prefixed.
 */

import { DEFAULT_CATALOG_FILENAME, TRASH_ACL_SNAPSHOT_FILE, TRASH_CONTAINER_NAME, TRASH_PAYLOAD_FILE, TRASH_TOMBSTONE_FILE } from "@/config";

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

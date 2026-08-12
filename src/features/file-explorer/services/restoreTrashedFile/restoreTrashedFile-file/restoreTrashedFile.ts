/**
 * @packageDocumentation
 * Restores a soft-deleted file to its original location by recreating
 * its payload, metadata, catalog entry, and best-effort ACL snapshot.
 * The trash copy is removed through {@link deleteResource} after a
 * successful restore.
 */

import { CONTENT_TYPES, DEFAULT_FILE_TYPE_URI, INDEX_FILE } from "@/config";
import { appendToCatalog, resourceFileName } from "@/infrastructure/solid/catalog";
import { copyResource, ensureContainer } from "@/infrastructure/solid/resourceCopy";
import { getAclSnapshotUri, getTombstoneUri, getTrashCatalogUri, getTrashPayloadUri } from "@/infrastructure/solid/trashPaths";
import { readTombstone } from "@/infrastructure/solid/tombstone";
import { restoreAclFromSnapshot } from "@/infrastructure/wac/aclSnapshot";
import { notifyCatalogChanged } from "@/shared/hooks/useCatalogVersion";
import { notifyAclChanged } from "@/shared/hooks/useAclVersion";
import { deleteResource, deleteResourceQuietly } from "@/features/file-explorer/services/deleteResource";
import type { FetchFn } from "@/types/solid";
import type { SharedEntry } from "@/types/sharing";

/**
 * Arguments for {@link restoreTrashedFile}.
 *
 * @public
 */
export interface RestoreTrashedFileArgs {
  // Container holding the trashed item.
  trashItemContainerUri: string;
  // Pod storage root containing the trash catalog.
  storageRootUri: string;
  // Catalog entry for the trashed item.
  entry: SharedEntry;
  // WebID of the user who originally owned the trashed item.
  ownerWebId: string;
  /** Authenticated Solid fetch. */
  fetch: FetchFn;
}

/**
 * Result envelope.
 *
 * @public
 */
export type RestoreTrashedFileResult =
  | { ok: true; restoredContainerUri: string; aclRestored: boolean }
  | { ok: false; reason: "occupied" | "missing-tombstone" | "failed"; detail?: string };

/**
 * Removes a partially restored copy while leaving the trash item intact,
 * allowing the restore operation to be retried.
 *
 * @internal
 */
function rollbackRestoredCopy(originalContainerUri: string, fetch: FetchFn): Promise<void> {
  return deleteResourceQuietly({ containerUri: originalContainerUri, fetch });
}

/**
 * Restores a soft-deleted file to its exact original location.
 *
 * @public
 */
export async function restoreTrashedFile(args: RestoreTrashedFileArgs): Promise<RestoreTrashedFileResult> {
  const { trashItemContainerUri, storageRootUri, entry, ownerWebId, fetch } = args;

  let tombstone;
  let originalIndexUri: string;
  let originalBinaryUri: string;
  try {
    tombstone = await readTombstone(getTombstoneUri(trashItemContainerUri), fetch);
    if (!tombstone) return { ok: false, reason: "missing-tombstone" };

    originalIndexUri = `${tombstone.originalContainerUri}${INDEX_FILE}`;
    originalBinaryUri = `${tombstone.originalContainerUri}${tombstone.originalBinaryName}`;

    const [indexOccupancy, binaryOccupancy] = await Promise.all([
      fetch(originalIndexUri, { method: "HEAD" }),
      fetch(originalBinaryUri, { method: "HEAD" }),
    ]);
    if (indexOccupancy.ok || binaryOccupancy.ok) return { ok: false, reason: "occupied" };
  } catch (error) {
    return { ok: false, reason: "failed", detail: error instanceof Error ? error.message : "Unknown error" };
  }

  const { originalContainerUri, originalCatalogUri, originalInstanceUri } = tombstone;
  let aclRestored = false;
  try {
    await ensureContainer(originalContainerUri, fetch);
    await copyResource(getTrashPayloadUri(trashItemContainerUri), originalBinaryUri, fetch, entry.mediaType);
    await copyResource(`${trashItemContainerUri}${INDEX_FILE}`, originalIndexUri, fetch, CONTENT_TYPES.TURTLE);

    if (tombstone.hasAclSnapshot) {
      try {
        aclRestored = await restoreAclFromSnapshot(getAclSnapshotUri(trashItemContainerUri), originalContainerUri, fetch);
      } catch {
        // Best-effort: the file is back even if its sharing grants are not.
        aclRestored = false;
      }
    }

    await appendToCatalog(
      originalCatalogUri,
      originalInstanceUri,
      originalBinaryUri,
      entry.classUri || DEFAULT_FILE_TYPE_URI,
      entry.mediaType || CONTENT_TYPES.OCTET_STREAM,
      entry.byteSize,
      entry.title || resourceFileName(originalContainerUri.replace(/\/$/, "")),
      entry.description,
      entry.modified,
      ownerWebId,
      fetch,
    );
  } catch (error) {
    await rollbackRestoredCopy(originalContainerUri, fetch);
    return { ok: false, reason: "failed", detail: error instanceof Error ? error.message : "Unknown error" };
  }

  // Trash cleanup is best-effort because the original resource has already been restored;
  // a failure only leaves a stale trash entry behind.
  await deleteResource({
    containerUri: trashItemContainerUri,
    fetch,
    catalogUri: getTrashCatalogUri(storageRootUri),
    metadataUri: entry.metadataUri,
  });

  notifyCatalogChanged(originalCatalogUri);
  notifyAclChanged(originalContainerUri);

  return { ok: true, restoredContainerUri: originalContainerUri, aclRestored };
}

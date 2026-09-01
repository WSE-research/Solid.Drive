/**
 * @packageDocumentation
 * Restores a soft-deleted folder: 
 * recreates its subtree, replays its
 * catalog snapshot, then removes the trash copy via {@link deleteResource}.
 */

import { copyContainerTree } from "@/infrastructure/solid/resourceCopy";
import { getAclSnapshotUri, getTombstoneUri, getTrashCatalogUri, getTrashFolderPayloadContainerUri } from "@/infrastructure/solid/trashPaths";
import { readTrashCatalogSnapshot, writeCatalogEntry } from "@/infrastructure/solid/catalogSnapshot";
import { readTombstone } from "@/infrastructure/solid/tombstone";
import { restoreAclFromSnapshot } from "@/infrastructure/wac/aclSnapshot";
import { notifyCatalogChanged } from "@/shared/hooks/useCatalogVersion";
import { notifyAclChanged } from "@/shared/hooks/useAclVersion";
import { deleteResource, deleteResourceQuietly } from "@/features/file-explorer/services/deleteResource";
import type { FetchFn } from "@/types/solid";

/**
 * Arguments for {@link restoreTrashedFolder}.
 *
 * @public
 */
export interface RestoreTrashedFolderArgs {
  // Container holding the trashed folder.
  trashItemContainerUri: string;
  // Pod storage root containing the trash catalog.
  storageRootUri: string;
  /** Authenticated Solid fetch. */
  fetch: FetchFn;
}

/**
 * Result envelope, mirroring `restoreTrashedFile`'s `RestoreTrashedFileResult`.
 *
 * @public
 */
export type RestoreTrashedFolderResult =
  | { ok: true; restoredContainerUri: string; aclRestored: boolean }
  | { ok: false; reason: "occupied" | "missing-tombstone" | "failed"; detail?: string };

/**
 * Removes a partially restored copy, leaving the trash item intact so the
 * restore can be retried.
 *
 * @remarks
 * `catalogUri`/`metadataUri` matter here: if the snapshot replay failed
 * partway through, some entries already landed in the main catalog.
 * `deleteResource` strips those as it deletes the subtree, the same
 * cleanup a normal folder delete does. Skip them and a failed restore
 * leaves ghost catalog rows behind.
 *
 * @internal
 */
function rollbackRestoredCopy(originalContainerUri: string, catalogUri: string, fetch: FetchFn): Promise<void> {
  return deleteResourceQuietly({
    containerUri: originalContainerUri,
    catalogUri,
    metadataUri: originalContainerUri,
    fetch,
  });
}

/**
 * Checks whether a folder's original location is free to restore to.
 *
 * @remarks
 * A file's restore check avoids HEAD-ing its container, since pods can
 * leave an empty container behind after deleting the file inside it. A
 * folder's container is fully gone once {@link deleteResource} hard-deletes
 * it, so HEAD-ing it directly works here.
 *
 * @internal
 */
async function isContainerOccupied(containerUri: string, fetch: FetchFn): Promise<boolean> {
  const response = await fetch(containerUri, { method: "HEAD", cache: "no-store" });
  return response.ok;
}

/**
 * Restores a soft-deleted folder to its exact original location.
 *
 * @public
 */
export async function restoreTrashedFolder(args: RestoreTrashedFolderArgs): Promise<RestoreTrashedFolderResult> {
  const { trashItemContainerUri, storageRootUri, fetch } = args;

  let tombstone;
  try {
    tombstone = await readTombstone(getTombstoneUri(trashItemContainerUri), fetch);
    if (!tombstone || tombstone.kind !== "folder") return { ok: false, reason: "missing-tombstone" };
    if (await isContainerOccupied(tombstone.originalContainerUri, fetch)) {
      return { ok: false, reason: "occupied" };
    }
  } catch (error) {
    return { ok: false, reason: "failed", detail: error instanceof Error ? error.message : "Unknown error" };
  }

  const { originalContainerUri, originalCatalogUri } = tombstone;
  let aclRestored = false;
  try {
    await copyContainerTree(getTrashFolderPayloadContainerUri(trashItemContainerUri), originalContainerUri, fetch);

    if (tombstone.hasAclSnapshot) {
      try {
        aclRestored = await restoreAclFromSnapshot(getAclSnapshotUri(trashItemContainerUri), originalContainerUri, fetch);
      } catch {
        // Best-effort: the folder is back even if its sharing grants are not.
        aclRestored = false;
      }
    }

    const snapshotEntries = await readTrashCatalogSnapshot(trashItemContainerUri, fetch);

    for (const entry of snapshotEntries) {
      await writeCatalogEntry(originalCatalogUri, entry, fetch);
    }
  } catch (error) {
    await rollbackRestoredCopy(originalContainerUri, originalCatalogUri, fetch);
    return { ok: false, reason: "failed", detail: error instanceof Error ? error.message : "Unknown error" };
  }

  // Best-effort: the original is already restored, so a failed cleanup here
  // just leaves a stale trash entry.
  await deleteResource({
    containerUri: trashItemContainerUri,
    fetch,
    catalogUri: getTrashCatalogUri(storageRootUri),
    metadataUri: trashItemContainerUri,
  });

  notifyCatalogChanged(originalCatalogUri);
  notifyAclChanged(originalContainerUri);

  return { ok: true, restoredContainerUri: originalContainerUri, aclRestored };
}

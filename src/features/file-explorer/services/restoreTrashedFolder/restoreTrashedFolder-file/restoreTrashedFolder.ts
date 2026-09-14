/**
 * @packageDocumentation
 * Restores a soft-deleted folder:
 * recreates its subtree, replays its
 * catalog snapshot, then removes the trash copy via {@link deleteResource}.
 *
 * When something already lives at that location, the restore stops and
 * describes both instead of guessing. A caller can then ask again with a
 * resolution: move the current folder to the Recycle Bin and take its
 * place, or keep both under a new name.
 */

import { findCatalogEntry } from "@/infrastructure/solid/catalogLookup";
import { copyContainerTree } from "@/infrastructure/solid/resourceCopy";
import { getAclSnapshotUri, getTombstoneUri, getTrashCatalogUri, getTrashFolderPayloadContainerUri } from "@/infrastructure/solid/trashPaths";
import { readTrashCatalogSnapshot, writeCatalogEntry } from "@/infrastructure/solid/catalogSnapshot";
import { readTombstone, type Tombstone } from "@/infrastructure/solid/tombstone";
import { restoreAclFromSnapshot } from "@/infrastructure/wac/aclSnapshot";
import { notifyCatalogChanged } from "@/shared/hooks/useCatalogVersion";
import { notifyAclChanged } from "@/shared/hooks/useAclVersion";
import { deleteResource, deleteResourceQuietly } from "@/features/file-explorer/services/deleteResource";
import { resolveKeepBothLocation } from "@/features/file-explorer/services/keepBothLocation";
import { softDeleteFolder } from "@/features/file-explorer/services/softDeleteFolder";
import type { RestoreConflict, RestoreConflictVersion, RestoreResolution } from "@/features/file-explorer/services/restoreTrashedFile";
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
  // WebID of the current user, needed only to move a conflicting folder to the Recycle Bin when resolution is "replace".
  ownerWebId?: string;
  /** Authenticated Solid fetch. */
  fetch: FetchFn;
  /** How to proceed if the original location turns out to be occupied. Omit to stop and report the conflict instead. */
  resolution?: RestoreResolution;
  /** The trashed folder's own modification time, shown in a conflict alongside whatever currently occupies its spot. */
  trashedModified?: string;
}

/**
 * Result envelope, mirroring `restoreTrashedFile`'s `RestoreTrashedFileResult`.
 *
 * @public
 */
export type RestoreTrashedFolderResult =
  | { ok: true; restoredContainerUri: string; aclRestored: boolean }
  | { ok: false; reason: "occupied"; conflict: RestoreConflict }
  | { ok: false; reason: "missing-tombstone" | "failed"; detail?: string; occupantMovedToTrash?: boolean };

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
 * Describes whatever folder currently occupies a restore's target
 * location, for the conflict a caller sees and for {@link replaceOccupant}
 * to act on.
 *
 * @internal
 */
async function describeOccupant(
  catalogUri: string,
  containerUri: string,
  fetch: FetchFn,
): Promise<RestoreConflictVersion> {
  const occupantEntry = await findCatalogEntry(catalogUri, containerUri, fetch);
  if (occupantEntry) return { modified: occupantEntry.modified || undefined, byteSize: occupantEntry.byteSize || undefined };

  const response = await fetch(containerUri, { method: "HEAD", cache: "no-store" });
  const lastModified = response.headers.get("Last-Modified");
  return { modified: lastModified ? new Date(lastModified).toISOString() : undefined };
}

/**
 * Moves whatever folder currently occupies the restore's target location
 * into the Recycle Bin, freeing it for the restore to proceed into.
 *
 * @internal
 */
async function replaceOccupant(
  tombstone: Tombstone,
  storageRootUri: string,
  ownerWebId: string,
  fetch: FetchFn,
): Promise<void> {
  const result = await softDeleteFolder({
    containerUri: tombstone.originalContainerUri,
    storageRootUri,
    catalogUri: tombstone.originalCatalogUri,
    ownerWebId,
    fetch,
  });
  if (!result.ok) throw new Error(`Could not move the folder in the way to the Recycle Bin: ${result.reason}`);
}

/**
 * Rewrites a URI that lives under `oldPrefix` to the same relative path
 * under `newPrefix`; any other URI is returned unchanged.
 *
 * @internal
 */
function rebase(uri: string, oldPrefix: string, newPrefix: string): string {
  return uri.startsWith(oldPrefix) ? `${newPrefix}${uri.slice(oldPrefix.length)}` : uri;
}

/**
 * Restores a soft-deleted folder, to its exact original location by
 * default.
 *
 * @public
 */
export async function restoreTrashedFolder(args: RestoreTrashedFolderArgs): Promise<RestoreTrashedFolderResult> {
  const { trashItemContainerUri, storageRootUri, ownerWebId, fetch, resolution, trashedModified } = args;

  let tombstone: Tombstone;
  try {
    const read = await readTombstone(getTombstoneUri(trashItemContainerUri), fetch);
    if (!read || read.kind !== "folder") return { ok: false, reason: "missing-tombstone" };
    tombstone = read;
  } catch (error) {
    return { ok: false, reason: "failed", detail: error instanceof Error ? error.message : "Unknown error" };
  }

  let targetContainerUri = tombstone.originalContainerUri;
  let occupantMovedToTrash = false;

  try {
    if (await isContainerOccupied(tombstone.originalContainerUri, fetch)) {
      if (resolution === "keepBoth") {
        targetContainerUri = await resolveKeepBothLocation(
          tombstone.originalContainerUri,
          (candidate) => isContainerOccupied(candidate, fetch),
        );
      } else if (resolution === "replace") {
        if (!ownerWebId) return { ok: false, reason: "failed", detail: "Not logged in" };
        await replaceOccupant(tombstone, storageRootUri, ownerWebId, fetch);
        occupantMovedToTrash = true;
      } else {
        const current = await describeOccupant(tombstone.originalCatalogUri, tombstone.originalContainerUri, fetch);
        return { ok: false, reason: "occupied", conflict: { current, trashed: { modified: trashedModified || undefined } } };
      }
    }
  } catch (error) {
    return { ok: false, reason: "failed", detail: error instanceof Error ? error.message : "Unknown error" };
  }

  const { originalContainerUri, originalCatalogUri } = tombstone;
  let aclRestored = false;
  try {
    await copyContainerTree(getTrashFolderPayloadContainerUri(trashItemContainerUri), targetContainerUri, fetch);

    if (tombstone.hasAclSnapshot) {
      try {
        aclRestored = await restoreAclFromSnapshot(getAclSnapshotUri(trashItemContainerUri), targetContainerUri, fetch);
      } catch {
        // Best-effort: the folder is back even if its sharing grants are not.
        aclRestored = false;
      }
    }

    const snapshotEntries = await readTrashCatalogSnapshot(trashItemContainerUri, fetch);

    for (const entry of snapshotEntries) {
      const target = targetContainerUri === originalContainerUri
        ? entry
        : {
            ...entry,
            uri: rebase(entry.uri, originalContainerUri, targetContainerUri),
            parentUri: entry.parentUri ? rebase(entry.parentUri, originalContainerUri, targetContainerUri) : entry.parentUri,
            accessURL: entry.accessURL ? rebase(entry.accessURL, originalContainerUri, targetContainerUri) : entry.accessURL,
          };
      await writeCatalogEntry(originalCatalogUri, target, fetch);
    }
  } catch (error) {
    await rollbackRestoredCopy(targetContainerUri, originalCatalogUri, fetch);
    return {
      ok: false,
      reason: "failed",
      detail: error instanceof Error ? error.message : "Unknown error",
      ...(occupantMovedToTrash && { occupantMovedToTrash: true }),
    };
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
  notifyAclChanged(targetContainerUri);

  return { ok: true, restoredContainerUri: targetContainerUri, aclRestored };
}

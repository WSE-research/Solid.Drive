/**
 * @packageDocumentation
 * Restores a soft-deleted file to its original location by recreating
 * its payload, metadata, catalog entry, and best-effort ACL snapshot.
 * The trash copy is removed through {@link deleteResource} after a
 * successful restore.
 *
 * When something already lives at that location, the restore stops and
 * describes both versions instead of guessing. A caller can then ask
 * again with a resolution: move the current file to the Recycle Bin and
 * take its place, or keep both under a new name.
 */

import { CONTENT_TYPES, DEFAULT_FILE_TYPE_URI, INDEX_FILE } from "@/config";
import { appendToCatalog, resourceFileName } from "@/infrastructure/solid/catalog";
import { findCatalogEntry } from "@/infrastructure/solid/catalogLookup";
import { copyResource, ensureContainer } from "@/infrastructure/solid/resourceCopy";
import { getAclSnapshotUri, getTombstoneUri, getTrashCatalogUri, getTrashPayloadUri } from "@/infrastructure/solid/trashPaths";
import { readTombstone, type Tombstone } from "@/infrastructure/solid/tombstone";
import { restoreAclFromSnapshot } from "@/infrastructure/wac/aclSnapshot";
import { notifyCatalogChanged } from "@/shared/hooks/useCatalogVersion";
import { notifyAclChanged } from "@/shared/hooks/useAclVersion";
import { deleteResource, deleteResourceQuietly } from "@/features/file-explorer/services/deleteResource";
import { resolveKeepBothLocation } from "@/features/file-explorer/services/keepBothLocation";
import { softDeleteFile } from "@/features/file-explorer/services/softDeleteFile";
import type { CatalogEntry } from "@/types/catalog";
import type { FetchFn } from "@/types/solid";
import type { SharedEntry } from "@/types/sharing";

/**
 * How to proceed when a restore finds its original location already
 * occupied.
 *
 * @public
 */
export type RestoreResolution = "replace" | "keepBoth";

/**
 * One version's size and modification time, for comparing the file being
 * restored against whatever currently occupies its spot. Either field is
 * missing when that detail couldn't be read.
 *
 * @public
 */
export interface RestoreConflictVersion {
  modified?: string;
  byteSize?: number;
}

/**
 * Both sides of a restore conflict, for a caller to show the person
 * choosing between them.
 *
 * @public
 */
export interface RestoreConflict {
  current: RestoreConflictVersion;
  trashed: RestoreConflictVersion;
}

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
  /** How to proceed if the original location turns out to be occupied. Omit to stop and report the conflict instead. */
  resolution?: RestoreResolution;
}

/**
 * Result envelope. `occupantMovedToTrash` is set on a failure that
 * happens after a "replace" already moved the file that was in the way:
 * that move isn't undone, so the failure leaves it sitting in the
 * Recycle Bin rather than back where it was.
 *
 * @public
 */
export type RestoreTrashedFileResult =
  | { ok: true; restoredContainerUri: string; aclRestored: boolean }
  | { ok: false; reason: "occupied"; conflict: RestoreConflict }
  | { ok: false; reason: "missing-tombstone" | "failed"; detail?: string; occupantMovedToTrash?: boolean };

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
 * @internal
 */
async function isLocationOccupied(indexUri: string, binaryUri: string, fetch: FetchFn): Promise<boolean> {
  const [indexOccupancy, binaryOccupancy] = await Promise.all([
    fetch(indexUri, { method: "HEAD", cache: "no-store" }),
    fetch(binaryUri, { method: "HEAD", cache: "no-store" }),
  ]);
  return indexOccupancy.ok || binaryOccupancy.ok;
}

/**
 * Describes whatever currently occupies a restore's target location,
 * for the conflict a caller sees and for {@link replaceOccupant} to act
 * on. Prefers its catalog row; falls back to the binary's own headers
 * for something with no catalog entry at all.
 *
 * @internal
 */
async function describeOccupant(
  catalogUri: string,
  instanceUri: string,
  binaryUri: string,
  fetch: FetchFn,
): Promise<{ version: RestoreConflictVersion; occupantEntry: CatalogEntry | null }> {
  const occupantEntry = await findCatalogEntry(catalogUri, instanceUri, fetch);
  if (occupantEntry) {
    return {
      version: { modified: occupantEntry.modified || undefined, byteSize: occupantEntry.byteSize || undefined },
      occupantEntry,
    };
  }

  const binaryHead = await fetch(binaryUri, { method: "HEAD", cache: "no-store" });
  const lastModified = binaryHead.headers.get("Last-Modified");
  const contentLength = binaryHead.headers.get("Content-Length");
  return {
    version: {
      modified: lastModified ? new Date(lastModified).toISOString() : undefined,
      byteSize: contentLength ? parseInt(contentLength, 10) : undefined,
    },
    occupantEntry: null,
  };
}

/**
 * Moves whatever currently occupies the restore's target location into
 * the Recycle Bin, freeing it for the restore to proceed into.
 *
 * @internal
 */
async function replaceOccupant(
  tombstone: Tombstone,
  occupantIndexUri: string,
  occupantBinaryUri: string,
  occupantEntry: CatalogEntry | null,
  storageRootUri: string,
  ownerWebId: string,
  fetch: FetchFn,
): Promise<void> {
  const occupantAsSharedEntry: SharedEntry = occupantEntry
    ? {
        metadataUri: occupantEntry.uri,
        binaryUri: occupantEntry.accessURL || occupantBinaryUri,
        classUri: occupantEntry.conformsTo,
        mediaType: occupantEntry.mediaType,
        byteSize: occupantEntry.byteSize,
        title: occupantEntry.title,
        description: occupantEntry.description,
        modified: occupantEntry.modified,
        parentUri: occupantEntry.parentUri,
      }
    : {
        metadataUri: occupantIndexUri,
        binaryUri: occupantBinaryUri,
        classUri: "",
        mediaType: "",
        byteSize: 0,
        title: "",
        description: "",
        modified: "",
      };

  const result = await softDeleteFile({
    containerUri: tombstone.originalContainerUri,
    storageRootUri,
    catalogUri: tombstone.originalCatalogUri,
    entry: occupantAsSharedEntry,
    ownerWebId,
    fetch,
  });
  if (!result.ok) throw new Error(`Could not move the file in the way to the Recycle Bin: ${result.reason}`);
}

/**
 * Restores a soft-deleted file, to its exact original location by
 * default.
 *
 * @public
 */
export async function restoreTrashedFile(args: RestoreTrashedFileArgs): Promise<RestoreTrashedFileResult> {
  const { trashItemContainerUri, storageRootUri, entry, ownerWebId, fetch, resolution } = args;

  let tombstone: Tombstone;
  try {
    const read = await readTombstone(getTombstoneUri(trashItemContainerUri), fetch);
    if (!read || read.kind !== "file") return { ok: false, reason: "missing-tombstone" };
    tombstone = read;
  } catch (error) {
    return { ok: false, reason: "failed", detail: error instanceof Error ? error.message : "Unknown error" };
  }

  let targetContainerUri = tombstone.originalContainerUri;
  let targetInstanceUri = tombstone.originalInstanceUri;
  let occupantMovedToTrash = false;

  try {
    const originalIndexUri = `${targetContainerUri}${INDEX_FILE}`;
    const originalBinaryUri = `${targetContainerUri}${tombstone.originalBinaryName}`;

    if (await isLocationOccupied(originalIndexUri, originalBinaryUri, fetch)) {
      if (resolution === "keepBoth") {
        targetContainerUri = await resolveKeepBothLocation(
          tombstone.originalContainerUri,
          (candidate) => isLocationOccupied(`${candidate}${INDEX_FILE}`, `${candidate}${tombstone.originalBinaryName}`, fetch),
        );
        targetInstanceUri = `${targetContainerUri}${INDEX_FILE}`;
      } else {
        const { version, occupantEntry } = await describeOccupant(
          tombstone.originalCatalogUri,
          tombstone.originalInstanceUri,
          originalBinaryUri,
          fetch,
        );
        if (resolution === "replace") {
          await replaceOccupant(tombstone, originalIndexUri, originalBinaryUri, occupantEntry, storageRootUri, ownerWebId, fetch);
          occupantMovedToTrash = true;
        } else {
          return {
            ok: false,
            reason: "occupied",
            conflict: {
              current: version,
              trashed: { modified: entry.modified || undefined, byteSize: entry.byteSize || undefined },
            },
          };
        }
      }
    }
  } catch (error) {
    return { ok: false, reason: "failed", detail: error instanceof Error ? error.message : "Unknown error" };
  }

  const targetIndexUri = `${targetContainerUri}${INDEX_FILE}`;
  const targetBinaryUri = `${targetContainerUri}${tombstone.originalBinaryName}`;
  const { originalCatalogUri } = tombstone;
  let aclRestored = false;
  try {
    await ensureContainer(targetContainerUri, fetch);
    await copyResource(getTrashPayloadUri(trashItemContainerUri), targetBinaryUri, fetch, entry.mediaType);
    await copyResource(`${trashItemContainerUri}${INDEX_FILE}`, targetIndexUri, fetch, CONTENT_TYPES.TURTLE);

    if (tombstone.hasAclSnapshot) {
      try {
        aclRestored = await restoreAclFromSnapshot(getAclSnapshotUri(trashItemContainerUri), targetContainerUri, fetch);
      } catch {
        // Best-effort: the file is back even if its sharing grants are not.
        aclRestored = false;
      }
    }

    await appendToCatalog({
      catalogUri: originalCatalogUri,
      instanceUri: targetInstanceUri,
      binaryUri: targetBinaryUri,
      classUri: entry.classUri || DEFAULT_FILE_TYPE_URI,
      parentUri: tombstone.originalParentUri,
      mediaType: entry.mediaType || CONTENT_TYPES.OCTET_STREAM,
      byteSize: entry.byteSize,
      title: entry.title || resourceFileName(targetContainerUri.replace(/\/$/, "")),
      description: entry.description,
      modified: entry.modified,
      publisherWebId: ownerWebId,
      fetch,
    });
  } catch (error) {
    await rollbackRestoredCopy(targetContainerUri, fetch);
    return {
      ok: false,
      reason: "failed",
      detail: error instanceof Error ? error.message : "Unknown error",
      ...(occupantMovedToTrash && { occupantMovedToTrash: true }),
    };
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
  notifyAclChanged(targetContainerUri);

  return { ok: true, restoredContainerUri: targetContainerUri, aclRestored };
}

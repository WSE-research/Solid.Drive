/**
 * @packageDocumentation
 * Moves a whole folder to the Recycle Bin instead of deleting it
 * immediately. The folder's subtree, preserving its relative structure,
 * and a snapshot of its catalog entries are copied to trash before the
 * original is removed.
 *
 * If preparation fails, the partial trash copy is rolled back and the
 * original folder remains untouched.
 */

import { FOLDER_CLASS_URI, appendFolderToCatalog, parseCatalog, resourceFileName } from "@/infrastructure/solid/catalog";
import { collectSubtreeCatalogEntries } from "@/infrastructure/solid/catalogSubtree";
import { copyContainerTree, ensureContainer } from "@/infrastructure/solid/resourceCopy";
import { writeCatalogEntry } from "@/infrastructure/solid/catalogSnapshot";
import {
  getAclSnapshotUri,
  getTombstoneUri,
  getTrashCatalogUri,
  getTrashContainerUri,
  getTrashFolderPayloadContainerUri,
  getTrashItemContainerUri,
  getTrashCatalogSnapshotUri,
} from "@/infrastructure/solid/trashPaths";
import { computeExpiry, writeTombstone } from "@/infrastructure/solid/tombstone";
import { snapshotAcl } from "@/infrastructure/wac/aclSnapshot";
import { checkHasPermission } from "@/infrastructure/wac/wacAllow";
import { TRASH_RETENTION_DAYS } from "@/config";
import { notifyCatalogChanged } from "@/shared/hooks/useCatalogVersion";
import { deleteResource, deleteResourceQuietly } from "@/features/file-explorer/services/deleteResource";
import type { FetchFn } from "@/types/solid";

/**
 * Arguments for {@link softDeleteFolder}.
 *
 * @public
 */
export interface SoftDeleteFolderArgs {
  // Folder being deleted.
  containerUri: string;
  // Pod storage root containing the Recycle Bin.
  storageRootUri: string;
  // The owner's main catalog.
  catalogUri: string;
  // WebID of the folder's owner, used as the trash catalog entry's publisher.
  ownerWebId: string;
  // Authenticated Solid fetch.
  fetch: FetchFn;
  /** Days until the trashed folder is eligible for purge. Defaults to {@link TRASH_RETENTION_DAYS}. */
  retentionDays?: number;
  // Injectable clock for deterministic tests. Defaults to `new Date()`.
  now?: Date;
  // Injectable trash item ID for deterministic tests. Defaults to `crypto.randomUUID()`.
  uniqueSuffix?: string;
}

/**
 * Result envelope, mirroring `softDeleteFile`'s `SoftDeleteFileResult`.
 *
 * @public
 */
export type SoftDeleteFolderResult =
  | { ok: true; trashItemContainerUri: string }
  | { ok: false; reason: string };

/**
 * Derives a container's parent container URI lexically, so permission
 * checking works even for a folder with no catalog entry of its own.
 *
 * @internal
 */
function parentContainerUriOf(containerUri: string): string {
  const trimmed = containerUri.replace(/\/$/, "");
  return `${trimmed.slice(0, trimmed.lastIndexOf("/"))}/`;
}

/**
 * Removes a partially written trash item while leaving the original intact.
 *
 * @internal
 */
function rollbackTrashCopy(trashItemContainerUri: string, fetch: FetchFn): Promise<void> {
  return deleteResourceQuietly({ containerUri: trashItemContainerUri, fetch });
}

/**
 * Soft-deletes a folder by moving a restorable copy of its subtree to
 * the Recycle Bin before removing the original.
 *
 * @param args - Folder, owner, storage, and retention information for the deletion.
 * @returns The soft-delete result and trash item URI when successful.
 *
 * @public
 */
export async function softDeleteFolder(args: SoftDeleteFolderArgs): Promise<SoftDeleteFolderResult> {
  const { containerUri, storageRootUri, catalogUri, ownerWebId, fetch } = args;
  const now = args.now ?? new Date();
  const retentionDays = args.retentionDays ?? TRASH_RETENTION_DAYS;
  const trashItemId = args.uniqueSuffix ?? crypto.randomUUID();

  const parentContainerUri = parentContainerUriOf(containerUri);
  if (!(await checkHasPermission(containerUri, parentContainerUri, fetch))) {
    return { ok: false, reason: "Missing permission to delete this folder" };
  }

  const catalogResponse = await fetch(catalogUri).catch(() => null);
  const catalogText = catalogResponse?.ok ? await catalogResponse.text() : "";
  const subtreeEntries = collectSubtreeCatalogEntries(parseCatalog(catalogText, catalogUri), containerUri);
  const rootEntry = subtreeEntries.find((entry) => entry.uri === containerUri);

  const title = rootEntry?.title || resourceFileName(containerUri.replace(/\/$/, ""));
  const modified = rootEntry?.modified || now.toISOString();
  const originalParentUri = rootEntry?.parentUri ?? parentContainerUri;

  const trashContainerUri = getTrashContainerUri(storageRootUri);
  const trashItemContainerUri = getTrashItemContainerUri(storageRootUri, trashItemId);
  const trashCatalogUri = getTrashCatalogUri(storageRootUri);
  const trashPayloadContainerUri = getTrashFolderPayloadContainerUri(trashItemContainerUri);
  const catalogSnapshotUri = getTrashCatalogSnapshotUri(trashItemContainerUri);

  try {
    await ensureContainer(trashContainerUri, fetch);
    await ensureContainer(trashItemContainerUri, fetch);

    let hasAclSnapshot = false;
    try {
      hasAclSnapshot = await snapshotAcl(containerUri, getAclSnapshotUri(trashItemContainerUri), fetch);
    } catch {
      // ACL preservation is best-effort and must not block the requested delete.
      hasAclSnapshot = false;
    }

    await copyContainerTree(containerUri, trashPayloadContainerUri, fetch);

    for (const entry of subtreeEntries) {
      await writeCatalogEntry(catalogSnapshotUri, entry, fetch);
    }

    await writeTombstone(
      getTombstoneUri(trashItemContainerUri),
      {
        kind: "folder",
        originalContainerUri: containerUri,
        originalParentUri,
        originalCatalogUri: catalogUri,
        originalInstanceUri: containerUri,
        originalBinaryName: "",
        originalClassUri: FOLDER_CLASS_URI,
        hasAclSnapshot,
        deletedAt: now.toISOString(),
        expiresAt: computeExpiry(now, retentionDays),
      },
      fetch,
    );

    await appendFolderToCatalog({
      catalogUri: trashCatalogUri,
      folderUri: trashItemContainerUri,
      parentUri: "",
      title,
      modified,
      publisherWebId: ownerWebId,
      fetch,
    });
  } catch (error) {
    await rollbackTrashCopy(trashItemContainerUri, fetch);
    return { ok: false, reason: error instanceof Error ? error.message : "Unknown error" };
  }

  const deleteResult = await deleteResource({ containerUri, metadataUri: containerUri, catalogUri, fetch });
  if (!deleteResult.ok) return deleteResult;

  notifyCatalogChanged(trashCatalogUri);
  return { ok: true, trashItemContainerUri };
}

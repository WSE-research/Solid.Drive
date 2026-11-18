/**
 * @packageDocumentation
 * Moves catalog-backed files to the Recycle Bin instead of deleting them immediately.
 * The file, metadata, and best-effort ACL snapshot are copied
 * to trash before the original resource is removed.
 *
 * If preparation fails, the partial trash copy is rolled back and the
 * original remains untouched.
 *
 * The original binary is only deleted if it is still the version that was
 * copied. With a strong entity tag, the `DELETE` carries `If-Match`, so the
 * server refuses it (412) when another client wrote the file in between.
 * RFC 9110 compares `If-Match` strongly, so a weak or missing tag cannot
 * guard the delete; then the binary is re-checked with `HEAD` (tag by weak
 * comparison, `Last-Modified`, and size) right before the `DELETE`, which
 * also carries `If-Unmodified-Since`. That fallback leaves a residual
 * window: a write landing between the re-check and the `DELETE`, within the
 * same second as the copied `Last-Modified` (or with no `Last-Modified` at
 * all), with the same size and weak tag, is still lost. Either way, a
 * detected change keeps the original, removes the trash copy and its trash
 * catalog row, and reports {@link FILE_CHANGED_DURING_DELETE}.
 */

import { CONTENT_TYPES, DEFAULT_FILE_TYPE_URI, INDEX_FILE, SYSTEM_FILES, TRASH_RETENTION_DAYS } from "@/config";
import { appendToCatalog, removeFromCatalog, resourceFileName } from "@/infrastructure/solid/catalog";
import { listContainerChildren } from "@/infrastructure/solid/containerListing";
import { copyResource, ensureContainer } from "@/infrastructure/solid/resourceCopy";
import type { CopiedRepresentation } from "@/infrastructure/solid/resourceCopy";
import { getAclSnapshotUri, getTombstoneUri, getTrashCatalogUri, getTrashContainerUri, getTrashItemContainerUri, getTrashPayloadUri } from "@/infrastructure/solid/trashPaths";
import { computeExpiry, writeTombstone } from "@/infrastructure/solid/tombstone";
import { snapshotAcl } from "@/infrastructure/wac/aclSnapshot";
import { checkHasPermission } from "@/infrastructure/wac/wacAllow";
import { isSharedCatalogFile } from "@/infrastructure/solid/sharedCatalog";
import { notifyCatalogChanged } from "@/shared/hooks/useCatalogVersion";
import { deleteResource, deleteResourceQuietly } from "@/features/file-explorer/services/deleteResource";
import type { FetchFn } from "@/types/solid";
import type { SharedEntry } from "@/types/sharing";

/**
 * Arguments for {@link softDeleteFile}.
 *
 * @public
 */
export interface SoftDeleteFileArgs {
  // Container holding the file being deleted. 
  containerUri: string;
  // Pod storage root containing the Recycle Bin.
  storageRootUri: string;
  // The owner's main catalog.
  catalogUri: string;
  // The file's catalog row payload. 
  entry: SharedEntry;
  // WebID of the file's owner, used as the trash catalog entry's publisher.
  ownerWebId: string;
  // Authenticated Solid fetch.
  fetch: FetchFn;
  /** Days until the trashed item is eligible for purge. Defaults to {@link TRASH_RETENTION_DAYS}. */
  retentionDays?: number;
  // Injectable clock for deterministic tests. Defaults to `new Date()`.
  now?: Date;
  // Injectable trash item ID for deterministic tests. Defaults to `crypto.randomUUID()`.
  uniqueSuffix?: string;
}

/**
 * Result envelope, mirroring {@link deleteResource}.
 *
 * @public
 */
export type SoftDeleteFileResult =
  | { ok: true; trashItemContainerUri: string }
  | { ok: false; reason: string };

/**
 * Failure reason when the original was written by someone else between
 * the copy into the trash and the delete. The original is kept.
 *
 * @public
 */
export const FILE_CHANGED_DURING_DELETE =
  "The file was changed while it was being deleted, so it was kept. Check the new version and delete it again if needed.";

/**
 * Checks whether a container child can represent the file's binary payload.
 *
 * @remarks
 * Excludes nested containers, `index.ttl`, system files, and shared catalog files.
 * 
 * @param childUri - The child resource URI to check
 * @returns True if the child is a plausible binary payload
 *
 * @internal
 */
function isBinaryCandidate(childUri: string): boolean {
  if (childUri.endsWith("/")) return false;
  const fileName = resourceFileName(childUri);
  return fileName !== INDEX_FILE && !SYSTEM_FILES.has(fileName) && !isSharedCatalogFile(fileName);
}

/**
 * Resolves the binary resource for the file being deleted.
 *
 * @remarks
 * Prefers the catalog entry's `binaryUri` and falls back to inspecting
 * the container when no separate binary URI is available.
 *
 * @internal
 */
async function resolveSourceBinaryUri(containerUri: string, entry: SharedEntry, fetch: FetchFn): Promise<string | null> {
  const hasOwnBinaryUri = entry.binaryUri && entry.binaryUri !== entry.metadataUri && !entry.binaryUri.endsWith('/');
  if (hasOwnBinaryUri) return entry.binaryUri;
  const children = await listContainerChildren(containerUri, fetch);
  return children.find(isBinaryCandidate) ?? null;
}

/**
 * verifies that the file's binary is still live.
 *
 * @internal
 */
async function checkIsActive(binaryUri: string, fetch: FetchFn): Promise<boolean> {
  const response = await fetch(binaryUri, { method: "HEAD" });
  return response.ok;
}

/**
 * Removes a partially written trash item while leaving the original intact.
 *
 * @remarks
 * Cleanup is best-effort because a leftover trash copy is safe and can
 * be purged later.
 *
 * @internal
 */
function rollbackTrashCopy(trashItemContainerUri: string, fetch: FetchFn): Promise<void> {
  return deleteResourceQuietly({ containerUri: trashItemContainerUri, fetch });
}

/** Opaque part of an entity tag, for weak comparison (RFC 9110, 8.8.3.2). */
function opaqueTag(etag: string): string {
  return etag.startsWith("W/") ? etag.slice(2) : etag;
}

/** A weak or missing tag cannot be used with `If-Match` (strong comparison). */
function isStrongEtag(etag: string | null): etag is string {
  return !!etag && !etag.startsWith("W/");
}

/**
 * Fallback check for a binary without a strong tag: has it changed since
 * it was copied, judged by weak tag comparison, `Last-Modified`, and size?
 * A failed `HEAD` counts as changed, so the original is kept.
 *
 * @internal
 */
async function hasChangedSinceCopy(binaryUri: string, copied: CopiedRepresentation, fetch: FetchFn): Promise<boolean> {
  const response = await fetch(binaryUri, { method: "HEAD", cache: "no-store" });
  if (!response.ok) return true;
  const etag = response.headers.get("ETag");
  if (copied.etag && etag && opaqueTag(copied.etag) !== opaqueTag(etag)) return true;
  const lastModified = response.headers.get("Last-Modified");
  if (copied.lastModified && lastModified && copied.lastModified !== lastModified) return true;
  const contentLength = response.headers.get("Content-Length");
  if (contentLength !== null && Number(contentLength) !== copied.size) return true;
  return false;
}

type BinaryDeleteOutcome = { kind: "deleted" } | { kind: "changed" } | { kind: "failed"; reason: string };

/**
 * Deletes the original binary only if it is still the copied version.
 * See the file docs for the strong-tag path and the weak-tag fallback.
 *
 * @internal
 */
async function deleteBinaryIfUnchanged(binaryUri: string, copied: CopiedRepresentation, fetch: FetchFn): Promise<BinaryDeleteOutcome> {
  const headers: Record<string, string> = {};
  if (isStrongEtag(copied.etag)) {
    headers["If-Match"] = copied.etag;
  } else {
    if (await hasChangedSinceCopy(binaryUri, copied, fetch)) return { kind: "changed" };
    if (copied.lastModified) headers["If-Unmodified-Since"] = copied.lastModified;
  }
  const response = await fetch(binaryUri, { method: "DELETE", headers });
  if (response.status === 412) return { kind: "changed" };
  if (!response.ok && response.status !== 404) {
    return { kind: "failed", reason: `${binaryUri}: ${response.status} ${response.statusText}` };
  }
  await fetch(`${binaryUri}.acl`, { method: "DELETE" }).catch(() => {});
  return { kind: "deleted" };
}

/**
 * Soft-deletes a file by moving a restorable copy to the Recycle Bin
 * before removing the original resource.
 *
 * @param args - File, owner, storage, and retention information for the deletion.
 * @returns The soft-delete result and trash item URI when successful.
 *
 * @public
 */
export async function softDeleteFile(args: SoftDeleteFileArgs): Promise<SoftDeleteFileResult> {
  const { containerUri, storageRootUri, catalogUri, entry, ownerWebId, fetch } = args;
  const now = args.now ?? new Date();
  const retentionDays = args.retentionDays ?? TRASH_RETENTION_DAYS;
  const trashItemId = args.uniqueSuffix ?? crypto.randomUUID();

  const sourceBinaryUri = await resolveSourceBinaryUri(containerUri, entry, fetch);
  if (!sourceBinaryUri) {
    return { ok: false, reason: "Could not locate the file's binary payload" };
  }

  if (!(await checkIsActive(sourceBinaryUri, fetch))) {
    return { ok: false, reason: "File is not present in the active area" };
  }
  if (!(await checkHasPermission(sourceBinaryUri, containerUri, fetch))) {
    return { ok: false, reason: "Missing permission to delete this file" };
  }

  const originalBinaryName = resourceFileName(sourceBinaryUri);
  const trashContainerUri = getTrashContainerUri(storageRootUri);
  const trashItemContainerUri = getTrashItemContainerUri(storageRootUri, trashItemId);
  const trashCatalogUri = getTrashCatalogUri(storageRootUri);
  const trashPayloadUri = getTrashPayloadUri(trashItemContainerUri);
  const trashIndexUri = `${trashItemContainerUri}${INDEX_FILE}`;
  let copied: CopiedRepresentation;

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

    copied = await copyResource(sourceBinaryUri, trashPayloadUri, fetch, entry.mediaType);
    await copyResource(`${containerUri}${INDEX_FILE}`, trashIndexUri, fetch, CONTENT_TYPES.TURTLE);

    await writeTombstone(
      getTombstoneUri(trashItemContainerUri),
      {
        kind: "file",
        originalContainerUri: containerUri,
        originalParentUri: entry.parentUri ?? "",
        originalCatalogUri: catalogUri,
        originalInstanceUri: entry.metadataUri,
        originalBinaryName,
        originalClassUri: entry.classUri || DEFAULT_FILE_TYPE_URI,
        hasAclSnapshot,
        deletedAt: now.toISOString(),
        expiresAt: computeExpiry(now, retentionDays),
      },
      fetch,
    );

    await appendToCatalog({
      catalogUri: trashCatalogUri,
      instanceUri: trashIndexUri,
      binaryUri: trashPayloadUri,
      classUri: entry.classUri || DEFAULT_FILE_TYPE_URI,
      parentUri: "",
      mediaType: entry.mediaType || CONTENT_TYPES.OCTET_STREAM,
      byteSize: entry.byteSize,
      title: entry.title || resourceFileName(containerUri.replace(/\/$/, "")),
      description: entry.description,
      modified: entry.modified || now.toISOString(),
      publisherWebId: ownerWebId,
      fetch,
    });
  } catch (error) {
    await rollbackTrashCopy(trashItemContainerUri, fetch);
    return { ok: false, reason: error instanceof Error ? error.message : "Unknown error" };
  }

  // The pivot: delete the binary first, and only if nobody wrote it since
  // the copy. The rest of the container (index.ttl) goes afterwards.
  const binaryDelete = await deleteBinaryIfUnchanged(sourceBinaryUri, copied, fetch);
  if (binaryDelete.kind === "changed") {
    await removeFromCatalog(trashCatalogUri, trashIndexUri, fetch).catch(() => {});
    await rollbackTrashCopy(trashItemContainerUri, fetch);
    notifyCatalogChanged(trashCatalogUri);
    return { ok: false, reason: FILE_CHANGED_DURING_DELETE };
  }
  if (binaryDelete.kind === "failed") return { ok: false, reason: binaryDelete.reason };

  const deleteResult = await deleteResource({ containerUri, metadataUri: entry.metadataUri, catalogUri, fetch });
  if (!deleteResult.ok) return deleteResult;

  notifyCatalogChanged(trashCatalogUri);
  return { ok: true, trashItemContainerUri };
}

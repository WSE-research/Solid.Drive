/**
 * @packageDocumentation
 * Manages the Recycle Bin by listing soft-deleted files and folders and
 * providing restore and HARD-delete actions. Reuses {@link useCatalog}
 * with the trash catalog and lazily purges expired items on load, since
 * cleanup is handled client-side without a server-side scheduler.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { useCatalog } from "@/features/file-explorer/hooks/useCatalog";
import { isFolderEntry } from "@/infrastructure/solid/catalog";
import { toContainerUri } from "@/infrastructure/solid/sharedCatalog";
import { getTombstoneUri, getTrashCatalogUri } from "@/infrastructure/solid/trashPaths";
import { readTrashFolderContents, type TrashFolderContents } from "@/infrastructure/solid/catalogSnapshot";
import { isExpired, readTombstone, type Tombstone } from "@/infrastructure/solid/tombstone";
import { notifyCatalogChanged } from "@/shared/hooks/useCatalogVersion";
import { deleteResource, type DeleteResourceResult } from "@/features/file-explorer/services/deleteResource";
import { restoreTrashedFile, type RestoreTrashedFileResult } from "@/features/file-explorer/services/restoreTrashedFile";
import { restoreTrashedFolder, type RestoreTrashedFolderResult } from "@/features/file-explorer/services/restoreTrashedFolder";
import type { CatalogEntry } from "@/types/catalog";
import type { SharedEntry } from "@/types/sharing";

// Stable fallback for tests.
// A new `[]` each render would re-run tombstone lookups.
const NO_FOLDER_ENTRIES: CatalogEntry[] = [];

/**
 * Represents a single Recycle Bin entry, including its catalog metadata,
 * trash container, and tombstone. The tombstone is `null` when missing
 * or invalid, allowing the item to be purged but not restored.
 *
 * @public
 */
export interface TrashEntry {
  /**
   * Whether the trashed item is a file or folder.
   *
   * @remarks
   * This is taken from the tombstone's `kind` when available, since that
   * value is written at delete time. It falls back to the trash catalog row
   * only when the tombstone is missing or invalid.
   */
  kind: "file" | "folder";
  entry: SharedEntry;
  containerUri: string;
  tombstone: Tombstone | null;
  
  /**
   * Snapshot of a trashed folder's contents.
   * Includes the item count and entries used by the Recycle Bin size
   * column. This is `null` for files and for folders whose tombstone or
   * snapshot could not be read.
   */
  contents: TrashFolderContents | null;
}

/**
 * Return shape of {@link useTrashEntries}.
 *
 * @public
 */
export interface UseTrashEntriesReturn {
  entries: TrashEntry[];
  loading: boolean;
  error: Error | null;
  restore: (item: TrashEntry) => Promise<RestoreTrashedFileResult | RestoreTrashedFolderResult>;
  /**
   * Permanently deletes a trashed item using {@link deleteResource}
   * against its trash container and catalog entry.
   */
  purge: (item: TrashEntry) => Promise<DeleteResourceResult>;
}

/**
 * @internal
 */
function toSharedEntry(catalogEntry: CatalogEntry): SharedEntry {
  return {
    metadataUri: catalogEntry.uri,
    binaryUri: catalogEntry.accessURL,
    classUri: catalogEntry.conformsTo,
    mediaType: catalogEntry.mediaType,
    byteSize: catalogEntry.byteSize,
    title: catalogEntry.title,
    description: catalogEntry.description,
    modified: catalogEntry.modified,
  };
}

/**
 * Lists entries from the Pod's trash catalog and resolves their tombstones.
 * Expired entries are lazily purged before the remaining items are exposed.
 *
 * @param storageRootUri - Pod storage root; `undefined` while it's still resolving
 * @returns Recycle Bin entries and their restore and purge operations.
 *
 * @public
 */
export function useTrashEntries(storageRootUri: string | undefined): UseTrashEntriesReturn {
  const { session, fetch: solidFetch } = useSolidAuth();
  const trashCatalogUri = storageRootUri ? getTrashCatalogUri(storageRootUri) : undefined;
  // The trash catalog is flat, so it needs both file and folder entries.
  const { entries: fileRows, folderEntries: folderRows = NO_FOLDER_ENTRIES, loading, error } = useCatalog(trashCatalogUri);
  const rows = useMemo(() => [...fileRows, ...folderRows], [fileRows, folderRows]);

  const [entries, setEntries] = useState<TrashEntry[]>([]);
  const [purgeError, setPurgeError] = useState<Error | null>(null);
  const processedRowsRef = useRef<CatalogEntry[] | null>(null);

  useEffect(() => {
    if (!trashCatalogUri) {
      processedRowsRef.current = rows;
      return;
    }
    if (processedRowsRef.current === rows) return;
    processedRowsRef.current = rows;

    let cancelled = false;

    void (async () => {
      try {
        const resolved = await Promise.all(
          rows.map(async (row) => {
            const containerUri = toContainerUri(row.uri);
            const tombstone = await readTombstone(getTombstoneUri(containerUri), solidFetch).catch(() => null);
            const kind = tombstone?.kind ?? (isFolderEntry(row) ? "folder" : "file");
            // Folder contents need the tombstone's original URI.
            // Without it, `contents` stays `null`.
            const contents = kind === "folder" && tombstone
              ? await readTrashFolderContents(containerUri, tombstone.originalContainerUri, solidFetch).catch(() => null)
              : null;
            return { row, containerUri, tombstone, kind, contents };
          }),
        );
        if (cancelled) return;

        const expired = resolved.filter(({ tombstone }) => tombstone !== null && isExpired(tombstone));
        const purgeResults = await Promise.all(
          expired.map(({ containerUri, row }) =>
            deleteResource({ containerUri, fetch: solidFetch, catalogUri: trashCatalogUri, metadataUri: row.uri }).then(
              (result) => ({ row, result }),
            ),
          ),
        );
        const failedToPurgeUris = new Set(
          purgeResults.filter(({ result }) => !result.ok).map(({ row }) => row.uri),
        );
        const live = resolved.filter(
          (candidate) => !expired.includes(candidate) || failedToPurgeUris.has(candidate.row.uri),
        );

        if (expired.length > 0 && !cancelled) notifyCatalogChanged(trashCatalogUri);

        if (!cancelled) {
          setPurgeError(null);
          setEntries(live.map(({ row, containerUri, tombstone, kind, contents }) => ({
            kind,
            entry: toSharedEntry(row),
            containerUri,
            tombstone,
            contents,
          })));
        }
      } catch (thrownError) {
        if (!cancelled) {
          setPurgeError(thrownError instanceof Error ? thrownError : new Error("Failed to process trash entries"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rows, trashCatalogUri, solidFetch]);

  const restore = useCallback(
    async (item: TrashEntry): Promise<RestoreTrashedFileResult | RestoreTrashedFolderResult> => {
      if (!storageRootUri) return { ok: false, reason: "failed", detail: "No storage root resolved yet" };
      if (item.kind === "folder") {
        return restoreTrashedFolder({
          trashItemContainerUri: item.containerUri,
          storageRootUri,
          fetch: solidFetch,
        });
      }
      if (!session.webId) return { ok: false, reason: "failed", detail: "Not logged in" };
      return restoreTrashedFile({
        trashItemContainerUri: item.containerUri,
        storageRootUri,
        entry: item.entry,
        ownerWebId: session.webId,
        fetch: solidFetch,
      });
    },
    [storageRootUri, session.webId, solidFetch],
  );

  const purge = useCallback(
    (item: TrashEntry): Promise<DeleteResourceResult> =>
      deleteResource({
        containerUri: item.containerUri,
        fetch: solidFetch,
        catalogUri: trashCatalogUri,
        metadataUri: item.entry.metadataUri,
      }),
    [solidFetch, trashCatalogUri],
  );

  // Derived rather than reset via effect: avoids a synchronous setState
  // when storageRootUri disappears, and needs no extra render to settle.
  const visibleEntries = trashCatalogUri ? entries : [];

  return { entries: visibleEntries, loading, error: error ?? purgeError, restore, purge };
}

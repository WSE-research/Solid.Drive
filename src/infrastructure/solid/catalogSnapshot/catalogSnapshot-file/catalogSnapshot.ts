/**
 * @packageDocumentation
 * Reads a trashed folder's catalog snapshot, reconciles it against what's
 * actually in the trash payload so an uncatalogued file or folder isn't
 * invisible, and writes one entry back into a target catalog. The shared
 * piece between snapshotting a folder's subtree at delete time and
 * replaying that snapshot back into the original catalog on restore.
 */

import { FOLDER_CLASS_URI, appendFolderToCatalog, appendToCatalog, isFolderEntry, parseCatalog, resourceFileName } from "@/infrastructure/solid/catalog";
import { collectSubtreeCatalogEntries } from "@/infrastructure/solid/catalogSubtree";
import { listContainerChildren } from "@/infrastructure/solid/containerListing";
import { toContainerUri } from "@/infrastructure/solid/sharedCatalog";
import { getTrashFolderPayloadContainerUri, getTrashCatalogSnapshotUri } from "@/infrastructure/solid/trashPaths";
import { INDEX_FILE, RDF_NAMESPACES } from "@/config";
import type { CatalogEntry } from "@/types";
import type { FetchFn } from "@/types/solid";

/**
 * Fetches and parses a trashed folder's catalog snapshot: its own catalog
 * row and every descendant's, taken at soft-delete time.
 *
 * @returns The parsed entries, or `[]` if the snapshot can't be read. A
 * missing or unreadable snapshot degrades to "nothing to show" rather than
 * throwing, since the trash item itself is still valid without it.
 *
 * @public
 */
export async function readTrashCatalogSnapshot(trashItemContainerUri: string, fetch: FetchFn): Promise<CatalogEntry[]> {
  const snapshotUri = getTrashCatalogSnapshotUri(trashItemContainerUri);
  const response = await fetch(snapshotUri);
  if (!response.ok) return [];
  return parseCatalog(await response.text(), snapshotUri);
}

/**
 * A trashed folder's contents, as recorded in its catalog snapshot.
 *
 * @public
 */
export interface TrashFolderContents {
  /** Every descendant entry, at any depth, root excluded. */
  entries: CatalogEntry[];
  fileCount: number;
  folderCount: number;
}

/**
 * Summarizes a trashed folder's catalog snapshot into its descendants and
 * their counts, the same way {@link collectSubtreeCatalogEntries} is used
 * elsewhere to walk a folder's subtree. Except the snapshot is already
 * scoped to just this folder, so `rootUri` only needs to strip the root's
 * own row out of the result, not select a subtree from a larger catalog.
 *
 * @param snapshotEntries - The parsed snapshot, from {@link readTrashCatalogSnapshot}
 * @param rootUri - The trashed folder's own original URI (its snapshot row)
 *
 * @public
 */
export function summarizeTrashFolder(snapshotEntries: CatalogEntry[], rootUri: string): TrashFolderContents {
  const entries = collectSubtreeCatalogEntries(snapshotEntries, rootUri).filter((entry) => entry.uri !== rootUri);
  const folderCount = entries.filter(isFolderEntry).length;
  return { entries, fileCount: entries.length - folderCount, folderCount };
}

// A bare entry has no dcterms:conformsTo to pick an icon by — this is the
// only signal left, since fetching each one's actual Content-Type would
// mean an extra request per uncatalogued item. Covers the media kinds a
// generic document tile would otherwise misrepresent; anything else still
// falls back to that generic tile, same as before.
const CLASS_URI_BY_EXTENSION: Record<string, string> = {
  jpg: `${RDF_NAMESPACES.SCHEMA}ImageObject`,
  jpeg: `${RDF_NAMESPACES.SCHEMA}ImageObject`,
  png: `${RDF_NAMESPACES.SCHEMA}ImageObject`,
  gif: `${RDF_NAMESPACES.SCHEMA}ImageObject`,
  webp: `${RDF_NAMESPACES.SCHEMA}ImageObject`,
  svg: `${RDF_NAMESPACES.SCHEMA}ImageObject`,
  bmp: `${RDF_NAMESPACES.SCHEMA}ImageObject`,
  mp4: `${RDF_NAMESPACES.SCHEMA}VideoObject`,
  mov: `${RDF_NAMESPACES.SCHEMA}VideoObject`,
  webm: `${RDF_NAMESPACES.SCHEMA}VideoObject`,
  mkv: `${RDF_NAMESPACES.SCHEMA}VideoObject`,
  mp3: `${RDF_NAMESPACES.SCHEMA}AudioObject`,
  wav: `${RDF_NAMESPACES.SCHEMA}AudioObject`,
  ogg: `${RDF_NAMESPACES.SCHEMA}AudioObject`,
  flac: `${RDF_NAMESPACES.SCHEMA}AudioObject`,
};

/** Guesses a schema.org class from a file name's extension, `""` if unknown. */
function classUriFromExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return "";
  return CLASS_URI_BY_EXTENSION[name.slice(dot + 1).toLowerCase()] ?? "";
}

/**
 * Turns a payload-tree relative path into a synthetic {@link CatalogEntry}
 * for something the snapshot never recorded — an uncatalogued file or
 * folder that was still physically inside the trashed folder. Carries only
 * what's actually knowable from the pod listing (name, kind, parent); size
 * and dates are left blank rather than guessed at or fetched with an extra
 * request per item. `conformsTo` for a file is a best-effort guess from its
 * extension, so it doesn't render as a generic document tile when it's
 * obviously a photo or video.
 *
 * @internal
 */
function bareEntry(originalUri: string, parentUri: string, isFolder: boolean): CatalogEntry {
  const title = resourceFileName(originalUri.replace(/\/$/, ""));
  return {
    uri: originalUri,
    conformsTo: isFolder ? FOLDER_CLASS_URI : classUriFromExtension(title),
    title,
    description: "",
    modified: "",
    publisher: "",
    mediaType: "",
    byteSize: 0,
    accessURL: "",
    parentUri,
  };
}

/**
 * Walks a trashed folder's live payload tree for anything the snapshot
 * doesn't already account for — a file or folder that was physically
 * inside the original folder but had no catalog entry when it was
 * soft-deleted, so `softDeleteFolder`'s snapshot never captured it.
 * `copyContainerTree` mirrors the payload from the pod tree directly,
 * not from catalog data, so a full restore recovers these regardless; this
 * is what keeps the trash view's item count accurate instead of silently
 * under-reporting what's actually there.
 *
 * @remarks
 * A container already represented by a snapshot entry (its relative path
 * is in `resolvedRelativePaths`) is trusted as fully accounted for and not
 * recursed into — its own children (an `index.ttl`, a binary) are that
 * entry's internals, not separate items. An unresolved container gets one
 * extra listing of its own to tell a bare file's container (it holds an
 * `index.ttl`, matching this app's file convention) from a genuine bare
 * folder, which is recursed into so nested bare content isn't missed.
 *
 * @internal
 */
async function collectBarePayloadEntries(
  containerUri: string,
  rootPayloadUri: string,
  rootOriginalUri: string,
  parentOriginalUri: string,
  resolvedRelativePaths: ReadonlySet<string>,
  fetch: FetchFn,
): Promise<CatalogEntry[]> {
  const children = await listContainerChildren(containerUri, fetch);
  const collected: CatalogEntry[] = [];

  for (const childUri of children) {
    const relativePath = childUri.slice(rootPayloadUri.length);
    if (resolvedRelativePaths.has(relativePath)) continue;

    const originalUri = `${rootOriginalUri}${relativePath}`;
    if (!childUri.endsWith("/")) {
      collected.push(bareEntry(originalUri, parentOriginalUri, false));
      continue;
    }

    const grandchildren = await listContainerChildren(childUri, fetch);
    const isFileContainer = grandchildren.includes(`${childUri}${INDEX_FILE}`);
    collected.push(bareEntry(originalUri, parentOriginalUri, !isFileContainer));
    if (!isFileContainer) {
      collected.push(
        ...(await collectBarePayloadEntries(childUri, rootPayloadUri, rootOriginalUri, originalUri, resolvedRelativePaths, fetch))
      );
    }
  }

  return collected;
}

/**
 * The full picture of a trashed folder's contents: every snapshot entry
 * plus whatever the live payload tree has that the snapshot doesn't,
 * merged into one list so the item count reflects everything that will
 * actually come back on a full restore.
 *
 * @remarks
 * The payload walk is best-effort: a listing failure degrades to the
 * snapshot-only result rather than hiding entries that did parse fine.
 *
 * @param trashItemContainerUri - The trash item's own container URI
 * @param originalContainerUri - The trashed folder's original URI, from its tombstone
 *
 * @public
 */
export async function readTrashFolderContents(
  trashItemContainerUri: string,
  originalContainerUri: string,
  fetch: FetchFn,
): Promise<TrashFolderContents> {
  const snapshotEntries = await readTrashCatalogSnapshot(trashItemContainerUri, fetch);
  const catalogued = summarizeTrashFolder(snapshotEntries, originalContainerUri);

  // A file's own snapshot entry is keyed by its index.ttl, one level
  // inside its own container — but the payload walk below enumerates that
  // container itself, not the index.ttl directly. toContainerUri maps both
  // shapes (a folder's own address, or a file's index.ttl) to the same
  // container-level path, so the comparison lines up either way.
  const resolvedRelativePaths = new Set(
    catalogued.entries
      .map((entry) => toContainerUri(entry.uri))
      .filter((containerUri) => containerUri.startsWith(originalContainerUri))
      .map((containerUri) => containerUri.slice(originalContainerUri.length))
  );

  const payloadRootUri = getTrashFolderPayloadContainerUri(trashItemContainerUri);
  const bare = await collectBarePayloadEntries(
    payloadRootUri,
    payloadRootUri,
    originalContainerUri,
    originalContainerUri,
    resolvedRelativePaths,
    fetch
  ).catch(() => []);

  const entries = [...catalogued.entries, ...bare];
  const folderCount = entries.filter(isFolderEntry).length;
  return { entries, fileCount: entries.length - folderCount, folderCount };
}

/**
 * Writes one catalog entry into `targetCatalogUri`, branching on whether
 * it describes a folder or a file. Every field, including the entry's own
 * URI and parent, is carried over unchanged.
 *
 * @remarks
 * Used both directions: `softDeleteFolder` snapshots a subtree's live
 * catalog rows into the trash catalog snapshot with this, and
 * `restoreTrashedFolder` replays the snapshot back into the original
 * catalog with the same function. The write is identical either way, only
 * the source and target catalog differ.
 *
 * @public
 */
export async function writeCatalogEntry(targetCatalogUri: string, entry: CatalogEntry, fetch: FetchFn): Promise<void> {
  if (isFolderEntry(entry)) {
    await appendFolderToCatalog({
      catalogUri: targetCatalogUri,
      folderUri: entry.uri,
      parentUri: entry.parentUri ?? "",
      title: entry.title,
      modified: entry.modified,
      publisherWebId: entry.publisher,
      fetch,
    });
    return;
  }
  await appendToCatalog({
    catalogUri: targetCatalogUri,
    instanceUri: entry.uri,
    binaryUri: entry.accessURL,
    classUri: entry.conformsTo,
    parentUri: entry.parentUri ?? "",
    mediaType: entry.mediaType,
    byteSize: entry.byteSize,
    title: entry.title,
    description: entry.description,
    modified: entry.modified,
    publisherWebId: entry.publisher,
    fetch,
  });
}

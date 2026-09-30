/**
 * @packageDocumentation
 * Defines and manages tombstones for soft-deleted files.
 *
 * @remarks
 * Tombstones preserve the original location, catalog metadata, deletion
 * time, and retention expiry needed for restore and lazy purge operations.
 * Everything another Solid application needs is written in standard terms:
 * Activity Streams 2.0 and PROV-O for the deletion, Dublin Core for the name,
 * former location, retention deadline, and preserved parts. The project's
 * own `trash:` vocabulary only records where the item sat in this app's
 * catalog, which no standard vocabulary describes.
 */

import { DataFactory, Parser as N3Parser, Store as N3Store } from "n3";
import type { FetchFn } from "@/types";
import { CONTENT_TYPES, INDEX_FILE, RDF_NAMESPACES, RDF_TYPE_URI, TRASH_TERMS } from "@/config";
import { serializeTurtle } from "@/infrastructure/solid/rdfUtils";
import { getAclSnapshotUri, getTrashCatalogSnapshotUri, getTrashFolderPayloadContainerUri, getTrashPayloadUri } from "@/infrastructure/solid/trashPaths";

const { namedNode, literal } = DataFactory;
const XSD_DATE_TIME = namedNode(`${RDF_NAMESPACES.XSD}dateTime`);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Dublin Core terms for the item's name, former location, retention deadline,
 * and preserved parts.
 */
const DCTERMS = {
  title: `${RDF_NAMESPACES.DCTERMS}title`,
  source: `${RDF_NAMESPACES.DCTERMS}source`,
  valid: `${RDF_NAMESPACES.DCTERMS}valid`,
  hasPart: `${RDF_NAMESPACES.DCTERMS}hasPart`,
} as const;

/**
 * PROV terms the thesis's tombstone shape requires: the tombstone is also a
 * `prov:Entity`, and its deletion time is repeated as `prov:invalidatedAtTime`
 * next to Activity Streams' `as:deleted`.
 */
const PROV = {
  Entity: `${RDF_NAMESPACES.PROV}Entity`,
  invalidatedAtTime: `${RDF_NAMESPACES.PROV}invalidatedAtTime`,
} as const;

/**
 * Metadata required to restore a soft-deleted file and determine its expiry.
 *
 * @public
 */
export interface Tombstone {
  /** Whether this trash item is a single file or a whole folder. */
  kind: "file" | "folder";
  /** Container URI the file or folder was deleted from. */
  originalContainerUri: string;
  /** Folder the item lived in, as recorded by its own catalog entry. Empty for an item at the storage root. */
  originalParentUri: string;
  /** Catalog the item's DCAT row lived in. */
  originalCatalogUri: string;
  /** The item's `dcat:dataset` URI in the original catalog. */
  originalInstanceUri: string;
  /**
   * Decoded filename of the payload, for restoring it under its original
   * name. Empty for a folder, whose payload is a container tree rather
   * than a single named file.
   */
  originalBinaryName: string;
  /**
   * Original resource class, stored through Activity Streams 2.0
   * `as:formerType`.
   */
  originalClassUri: string;
  /** Whether an `acl-snapshot.ttl` was captured alongside this tombstone. */
  hasAclSnapshot: boolean;
  /** ISO 8601 timestamp of the delete, written as Activity Streams 2.0's `as:deleted`. */
  deletedAt: string;
  /** ISO 8601 timestamp after which the item is eligible for purge. */
  expiresAt: string;
}

/**
 * Serializes a tombstone to Turtle. Everything another application needs is
 * written in standard terms; the project's `trash:` terms only record where
 * the item sat in this app's catalog.
 *
 * @public
 */
export function buildTombstoneTurtle(tombstoneUri: string, tombstone: Tombstone): string {
  const subject = namedNode(tombstoneUri);
  return serializeTurtle([
    DataFactory.quad(subject, namedNode(RDF_TYPE_URI), namedNode(TRASH_TERMS.Tombstone)),
    DataFactory.quad(subject, namedNode(RDF_TYPE_URI), namedNode(PROV.Entity)),
    DataFactory.quad(subject, namedNode(TRASH_TERMS.deletedAt), literal(tombstone.deletedAt, XSD_DATE_TIME)),
    DataFactory.quad(subject, namedNode(PROV.invalidatedAtTime), literal(tombstone.deletedAt, XSD_DATE_TIME)),
    DataFactory.quad(subject, namedNode(TRASH_TERMS.formerType), namedNode(tombstone.originalClassUri)),
    DataFactory.quad(subject, namedNode(DCTERMS.title), literal(displayName(tombstone))),
    DataFactory.quad(subject, namedNode(DCTERMS.source), namedNode(tombstone.originalContainerUri)),
    DataFactory.quad(subject, namedNode(DCTERMS.valid), literal(tombstone.expiresAt, XSD_DATE_TIME)),
    ...preservedPartUris(tombstoneUri, tombstone).map((partUri) =>
      DataFactory.quad(subject, namedNode(DCTERMS.hasPart), namedNode(partUri)),
    ),
    DataFactory.quad(subject, namedNode(TRASH_TERMS.kind), literal(tombstone.kind)),
    ...(tombstone.originalParentUri
      ? [DataFactory.quad(subject, namedNode(TRASH_TERMS.originalParent), namedNode(tombstone.originalParentUri))]
      : []),
    DataFactory.quad(subject, namedNode(TRASH_TERMS.originalCatalog), namedNode(tombstone.originalCatalogUri)),
    DataFactory.quad(subject, namedNode(TRASH_TERMS.originalInstance), namedNode(tombstone.originalInstanceUri)),
  ]);
}

/** Returns the trash item container a tombstone lives in. */
function trashItemContainerOf(tombstoneUri: string): string {
  return tombstoneUri.slice(0, tombstoneUri.lastIndexOf("/") + 1);
}

/**
 * Returns the name the user knew the item by: the file name for a file,
 * the last path segment for a folder.
 */
function displayName(tombstone: Tombstone): string {
  if (tombstone.kind === "file") return tombstone.originalBinaryName;
  const segments = tombstone.originalContainerUri.replace(/\/$/, "").split("/");
  return decodeURIComponent(segments[segments.length - 1] ?? "");
}

/**
 * Lists the resources in the trash entry that hold the preserved content,
 * its metadata, and the access-control snapshot if one was taken. Linking
 * them from the tombstone lets another application find them for a restore
 * without knowing how this app lays out a trash entry.
 */
function preservedPartUris(tombstoneUri: string, tombstone: Tombstone): string[] {
  const trashItemContainerUri = trashItemContainerOf(tombstoneUri);
  const contentParts =
    tombstone.kind === "file"
      ? [getTrashPayloadUri(trashItemContainerUri), `${trashItemContainerUri}${INDEX_FILE}`]
      : [getTrashFolderPayloadContainerUri(trashItemContainerUri), getTrashCatalogSnapshotUri(trashItemContainerUri)];
  return tombstone.hasAclSnapshot ? [...contentParts, getAclSnapshotUri(trashItemContainerUri)] : contentParts;
}

/**
 * Parses a Turtle tombstone document.
 *
 * @remarks
 * Returns `null` when the document is malformed or any required field
 * is missing, preventing restores from incomplete tombstone data.
 *
 * @param turtleText - Raw Turtle content.
 * @param baseUri - Base URI used to resolve the tombstone subject.
 * @returns The parsed tombstone, or `null` when it is invalid or incomplete.
 *
 * @public
 */
export function parseTombstone(turtleText: string, baseUri: string): Tombstone | null {
  let quads;
  try {
    quads = new N3Parser({ baseIRI: baseUri }).parse(turtleText);
  } catch {
    return null;
  }

  const store = new N3Store(quads);
  const firstValue = (...predicates: string[]) =>
    predicates.map((predicate) => store.getObjects(baseUri, predicate, null)[0]?.value).find((found) => found !== undefined);

  // Absent on a tombstone written before folders could be soft-deleted;
  // every such tombstone is, by definition, for a file.
  const kind = firstValue(TRASH_TERMS.kind) === "folder" ? "folder" : "file";
  const originalContainerUri = firstValue(DCTERMS.source);
  const originalParentUri = firstValue(TRASH_TERMS.originalParent) ?? "";
  const originalCatalogUri = firstValue(TRASH_TERMS.originalCatalog);
  const originalInstanceUri = firstValue(TRASH_TERMS.originalInstance);
  // Only a file's payload has an original filename to restore under; a
  // folder's title is its name, not a payload filename.
  const originalBinaryName = kind === "file" ? (firstValue(DCTERMS.title) ?? "") : "";
  const originalClassUri = firstValue(TRASH_TERMS.formerType);
  const deletedAt = firstValue(TRASH_TERMS.deletedAt, PROV.invalidatedAtTime);
  const expiresAt = firstValue(DCTERMS.valid);

  if (
    !originalContainerUri ||
    !originalCatalogUri ||
    !originalInstanceUri ||
    (kind === "file" && !originalBinaryName) ||
    !originalClassUri ||
    !deletedAt ||
    !expiresAt
  ) {
    return null;
  }

  return {
    kind,
    originalContainerUri,
    originalParentUri,
    originalCatalogUri,
    originalInstanceUri,
    originalBinaryName,
    originalClassUri,
    hasAclSnapshot: readHasAclSnapshot(store, baseUri),
    deletedAt,
    expiresAt,
  };
}

/** Tells whether the tombstone links an access-control snapshot as one of its parts. */
function readHasAclSnapshot(store: N3Store, tombstoneUri: string): boolean {
  const snapshotUri = getAclSnapshotUri(trashItemContainerOf(tombstoneUri));
  return store.getObjects(tombstoneUri, DCTERMS.hasPart, null).some((part) => part.value === snapshotUri);
}

/**
 * Writes a tombstone document, replacing any existing resource at the URI.
 *
 * @param tombstoneUri - URI of the tombstone resource.
 * @param tombstone - Tombstone metadata to write.
 * @param fetch - Authenticated Solid fetch function.
 *
 * @public
 */
export async function writeTombstone(tombstoneUri: string, tombstone: Tombstone, fetch: FetchFn): Promise<void> {
  const response = await fetch(tombstoneUri, {
    method: "PUT",
    headers: { "Content-Type": CONTENT_TYPES.TURTLE },
    body: buildTombstoneTurtle(tombstoneUri, tombstone),
  });
  if (!response.ok) {
    throw new Error(`Failed to write tombstone at ${tombstoneUri}: ${response.status} ${response.statusText}`);
  }
}

/**
 * Reads and parses a tombstone document.
 *
 * @remarks
 * Returns `null` when the tombstone does not exist. Other HTTP failures
 * are reported as errors.
 *
 * @param tombstoneUri - URI of the tombstone resource.
 * @param fetch - Authenticated Solid fetch function.
 * @returns The parsed tombstone, or `null` when no tombstone exists or its document is invalid.
 *
 * @public
 */
export async function readTombstone(tombstoneUri: string, fetch: FetchFn): Promise<Tombstone | null> {
  const response = await fetch(tombstoneUri, { headers: { Accept: CONTENT_TYPES.TURTLE } });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to read tombstone at ${tombstoneUri}: ${response.status} ${response.statusText}`);
  }
  return parseTombstone(await response.text(), tombstoneUri);
}

/**
 * Computes the expiry timestamp for a retention period.
 *
 * @param deletedAt - Time at which the resource was deleted.
 * @param retentionDays - Number of days the item should be retained.
 * @returns The expiry timestamp as an ISO 8601 string.
 *
 * @public
 */
export function computeExpiry(deletedAt: Date, retentionDays: number): string {
  return new Date(deletedAt.getTime() + retentionDays * MS_PER_DAY).toISOString();
}

/**
 * Checks whether a tombstone has reached its expiry time.
 *
 * @param tombstone - Tombstone to evaluate.
 * @param now - Time used for the comparison. Defaults to the current time.
 * @returns `true` when the tombstone has expired.
 *
 * @public
 */
export function isExpired(tombstone: Tombstone, now: Date = new Date()): boolean {
  return new Date(tombstone.expiresAt).getTime() <= now.getTime();
}

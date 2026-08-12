/**
 * @packageDocumentation
 * Defines and manages tombstones for soft-deleted files.
 *
 * @remarks
 * Tombstones preserve the original location, catalog metadata, deletion
 * time, and retention expiry needed for restore and lazy purge operations.
 * Standard deletion terms reuse Activity Streams 2.0 where applicable.
 */

import { DataFactory, Parser as N3Parser, Store as N3Store } from "n3";
import type { FetchFn } from "@/types";
import { CONTENT_TYPES, RDF_NAMESPACES, RDF_TYPE_URI, TRASH_TERMS } from "@/config";
import { serializeTurtle } from "@/infrastructure/solid/rdfUtils";

const { namedNode, literal } = DataFactory;
const XSD_BOOLEAN = namedNode(`${RDF_NAMESPACES.XSD}boolean`);
const XSD_DATE_TIME = namedNode(`${RDF_NAMESPACES.XSD}dateTime`);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Metadata required to restore a soft-deleted file and determine its expiry.
 *
 * @public
 */
export interface Tombstone {
  /** Container URI the file was deleted from. */
  originalContainerUri: string;
  /** Catalog the file's DCAT row lived in. */
  originalCatalogUri: string;
  /** The file's `dcat:dataset` URI in the original catalog. */
  originalInstanceUri: string;
  /** Decoded filename of the payload, for restoring it under its original name. */
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
 * Serializes a tombstone to Turtle.
 *
 * @public
 */
export function buildTombstoneTurtle(tombstoneUri: string, tombstone: Tombstone): string {
  const subject = namedNode(tombstoneUri);
  return serializeTurtle([
    DataFactory.quad(subject, namedNode(RDF_TYPE_URI), namedNode(TRASH_TERMS.Tombstone)),
    DataFactory.quad(subject, namedNode(TRASH_TERMS.originalContainer), namedNode(tombstone.originalContainerUri)),
    DataFactory.quad(subject, namedNode(TRASH_TERMS.originalCatalog), namedNode(tombstone.originalCatalogUri)),
    DataFactory.quad(subject, namedNode(TRASH_TERMS.originalInstance), namedNode(tombstone.originalInstanceUri)),
    DataFactory.quad(subject, namedNode(TRASH_TERMS.originalBinaryName), literal(tombstone.originalBinaryName)),
    DataFactory.quad(subject, namedNode(TRASH_TERMS.formerType), namedNode(tombstone.originalClassUri)),
    DataFactory.quad(subject, namedNode(TRASH_TERMS.hasAclSnapshot), literal(String(tombstone.hasAclSnapshot), XSD_BOOLEAN)),
    DataFactory.quad(subject, namedNode(TRASH_TERMS.deletedAt), literal(tombstone.deletedAt, XSD_DATE_TIME)),
    DataFactory.quad(subject, namedNode(TRASH_TERMS.expiresAt), literal(tombstone.expiresAt, XSD_DATE_TIME)),
  ]);
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
  const value = (predicate: string) => store.getObjects(baseUri, predicate, null)[0]?.value;

  const originalContainerUri = value(TRASH_TERMS.originalContainer);
  const originalCatalogUri = value(TRASH_TERMS.originalCatalog);
  const originalInstanceUri = value(TRASH_TERMS.originalInstance);
  const originalBinaryName = value(TRASH_TERMS.originalBinaryName);
  const originalClassUri = value(TRASH_TERMS.formerType);
  const hasAclSnapshotRaw = value(TRASH_TERMS.hasAclSnapshot);
  const deletedAt = value(TRASH_TERMS.deletedAt);
  const expiresAt = value(TRASH_TERMS.expiresAt);

  if (
    !originalContainerUri ||
    !originalCatalogUri ||
    !originalInstanceUri ||
    !originalBinaryName ||
    !originalClassUri ||
    hasAclSnapshotRaw === undefined ||
    !deletedAt ||
    !expiresAt
  ) {
    return null;
  }

  return {
    originalContainerUri,
    originalCatalogUri,
    originalInstanceUri,
    originalBinaryName,
    originalClassUri,
    hasAclSnapshot: hasAclSnapshotRaw === "true",
    deletedAt,
    expiresAt,
  };
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

/**
 * @packageDocumentation
 * The tombstone log behind a catalog's OR-set: which entry tags have been
 * removed, and when. A stale device re-uploading its old copy of a
 * deleted file carries a tag already recorded here and gets suppressed; a
 * genuinely new file always gets a fresh tag, so it can never collide
 * with a tombstoned one.
 *
 * @remarks
 * Appends and purges use N3 Patch instead of a GET/PUT round trip, so two
 * devices tombstoning different entries at the same moment never race on
 * the same document. Retention is a deliberate, honest bound: a device
 * offline longer than the retention window can still resurrect a stale
 * file, the same trade-off object storage services like S3 and GCS
 * accept for their own delete markers.
 */

import { Parser as N3Parser, Store as N3Store } from "n3";
import type { FetchFn } from "@/types";
import { CATALOG_TOMBSTONE_LOG_FILENAME, CATALOG_TOMBSTONE_RETENTION_DAYS, CONTENT_TYPES, RDF_NAMESPACES } from "@/config";
import { isValidEntryTag } from "@/infrastructure/solid/entryTag";

const AS_DELETED = `${RDF_NAMESPACES.ACTIVITY_STREAMS}deleted`;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const tombstoneSubject = (tag: string): string => `urn:uuid:${tag}`;

function tombstoneTriple(tag: string, deletedAtIso: string): string {
  return `  <${tombstoneSubject(tag)}> <${AS_DELETED}> "${deletedAtIso}"^^<${RDF_NAMESPACES.XSD}dateTime> .`;
}

function buildN3Patch(kind: "inserts" | "deletes", triples: string[]): string {
  return `@prefix solid: <${RDF_NAMESPACES.SOLID_TERMS}> .

_:patch a solid:InsertDeletePatch ;
  solid:${kind} {
${triples.join("\n")}
  } .
`;
}

/**
 * Derives a catalog's tombstone log URI: a fixed-name sibling resource in
 * the same container as the catalog itself.
 *
 * @public
 */
export function resolveTombstoneLogUri(catalogUri: string): string {
  const containerUri = catalogUri.slice(0, catalogUri.lastIndexOf("/") + 1);
  return `${containerUri}${CATALOG_TOMBSTONE_LOG_FILENAME}`;
}

/**
 * Records removed entry tags in a catalog's tombstone log.
 *
 * @remarks
 * Does nothing for an empty `tags` list. Creates the log with a plain PUT
 * the first time anything is tombstoned, since PATCH can't create a
 * resource that doesn't exist yet; every later call appends through
 * PATCH instead.
 *
 * @public
 */
export async function appendTombstones(
  catalogUri: string,
  tags: readonly string[],
  fetch: FetchFn,
  now: Date = new Date(),
): Promise<void> {
  if (tags.length === 0) return;
  for (const tag of tags) {
    if (!isValidEntryTag(tag)) throw new Error(`Invalid catalog entry tag: "${tag}"`);
  }

  const tombstoneLogUri = resolveTombstoneLogUri(catalogUri);
  const deletedAtIso = now.toISOString();
  const triples = tags.map((tag) => tombstoneTriple(tag, deletedAtIso));

  const patchResponse = await fetch(tombstoneLogUri, {
    method: "PATCH",
    headers: { "Content-Type": CONTENT_TYPES.N3 },
    body: buildN3Patch("inserts", triples),
  });
  if (patchResponse.ok) return;
  if (patchResponse.status !== 404) {
    throw new Error(`Failed to append tombstones at ${tombstoneLogUri}: ${patchResponse.status} ${patchResponse.statusText}`);
  }

  const putResponse = await fetch(tombstoneLogUri, {
    method: "PUT",
    headers: { "Content-Type": CONTENT_TYPES.TURTLE },
    body: triples.join("\n"),
  });
  if (!putResponse.ok) {
    throw new Error(`Failed to create tombstone log at ${tombstoneLogUri}: ${putResponse.status} ${putResponse.statusText}`);
  }
}

/**
 * Reads a catalog's tombstone log.
 *
 * @returns A map of tombstoned tag to its deletion time, as an ISO 8601
 * string. Empty when the log doesn't exist yet, meaning nothing has ever
 * been removed from this catalog.
 *
 * @public
 */
export async function readTombstonedTags(catalogUri: string, fetch: FetchFn): Promise<ReadonlyMap<string, string>> {
  const tombstoneLogUri = resolveTombstoneLogUri(catalogUri);
  const response = await fetch(tombstoneLogUri, { headers: { Accept: CONTENT_TYPES.TURTLE } });
  if (response.status === 404) return new Map();
  if (!response.ok) {
    throw new Error(`Failed to read tombstone log at ${tombstoneLogUri}: ${response.status} ${response.statusText}`);
  }

  let quads;
  try {
    quads = new N3Parser({ baseIRI: tombstoneLogUri }).parse(await response.text());
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Tombstone log at ${tombstoneLogUri} contains invalid Turtle and could not be read (${detail})`, { cause: error });
  }

  const store = new N3Store(quads);
  const tombstones = new Map<string, string>();
  for (const quad of store.getQuads(null, AS_DELETED, null, null)) {
    const subject = quad.subject.value;
    if (!subject.startsWith("urn:uuid:")) continue;
    tombstones.set(subject.slice("urn:uuid:".length), quad.object.value);
  }
  return tombstones;
}

/**
 * Drops tombstones past their retention window.
 *
 * @remarks
 * Deletes exactly the expired triples, so a tombstone another device
 * appends while this sweep is running is never lost.
 *
 * @param retentionDays - How long a tombstone is kept before it's
 * eligible for purge. Defaults to {@link CATALOG_TOMBSTONE_RETENTION_DAYS}.
 *
 * @public
 */
export async function purgeExpiredTombstones(
  catalogUri: string,
  fetch: FetchFn,
  retentionDays: number = CATALOG_TOMBSTONE_RETENTION_DAYS,
  now: Date = new Date(),
): Promise<void> {
  const tombstones = await readTombstonedTags(catalogUri, fetch);
  const expired = [...tombstones].filter(
    ([, deletedAtIso]) => new Date(deletedAtIso).getTime() + retentionDays * MS_PER_DAY <= now.getTime(),
  );
  if (expired.length === 0) return;

  const tombstoneLogUri = resolveTombstoneLogUri(catalogUri);
  const triples = expired.map(([tag, deletedAtIso]) => tombstoneTriple(tag, deletedAtIso));
  const response = await fetch(tombstoneLogUri, {
    method: "PATCH",
    headers: { "Content-Type": CONTENT_TYPES.N3 },
    body: buildN3Patch("deletes", triples),
  });
  if (!response.ok) {
    throw new Error(`Failed to purge tombstones at ${tombstoneLogUri}: ${response.status} ${response.statusText}`);
  }
}

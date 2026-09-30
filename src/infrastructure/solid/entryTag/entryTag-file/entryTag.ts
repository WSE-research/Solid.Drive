/**
 * @packageDocumentation
 * Mints and validates the unique tag every catalog entry carries: the
 * "unique element" half of an OR-set. A tag is minted once, when an entry
 * is first added, and never reused, so a tombstone log can tell a
 * genuinely new entry apart from a stale re-add of a deleted one.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mints a fresh entry tag.
 *
 * @public
 */
export function generateEntryTag(): string {
  return crypto.randomUUID();
}

/**
 * Checks that a tag is shaped like a UUID, the only form one is ever
 * minted in.
 *
 * @remarks
 * A tag can arrive from another party's catalog entry, not just be minted
 * locally, so every place a tag is interpolated into RDF or an N3 Patch
 * document validates it first.
 *
 * @public
 */
export function isValidEntryTag(tag: string): boolean {
  return UUID_PATTERN.test(tag);
}

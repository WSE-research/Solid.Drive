/**
 * Derives the per-file container slug used when uploading into a Pod.
 *
 * @packageDocumentation
 */

/**
 * Maps a file name to the container slug an upload creates for it.
 *
 * @remarks
 * The mapping is lossy on purpose — everything outside `[a-z0-9.]` collapses to
 * a single `-` — so distinct names can share a slug (`"a b.txt"` and
 * `"a-b.txt"` both become `a-b.txt`). Since the container is created with
 * `createChildAndOverwrite`, two files that collide here overwrite each other.
 *
 * That makes the slug, not the file name, the correct collision key for
 * anything de-duplicating a batch before upload. This lives in its own module
 * rather than beside its caller so both the writer and the de-duplicator can
 * import the one rule without either depending on the other.
 *
 * @param fileName - Name of the file being uploaded.
 * @returns The slug, without a trailing slash.
 *
 * @public
 */
export function containerSlugFor(fileName: string): string {
  return fileName.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
}

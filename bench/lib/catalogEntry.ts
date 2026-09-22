/**
 * @packageDocumentation
 * The catalog entry every network runner appends. Each entry describes one
 * `byteSize`-byte file, and it is the same input both write methods take, so it
 * lives here once instead of being copied into each runner.
 */

import type { CatalogAppend } from "./buildN3Patch";

/** One catalog entry for `id`, describing a `byteSize`-byte file owned by `webId` under `pod`. */
export function makeCatalogEntry(pod: string, webId: string, id: string, byteSize: number): CatalogAppend {
  return {
    catalogUri: "",
    instanceUri: `${pod}items/${id}/`,
    binaryUri: `${pod}items/${id}/payload`,
    classUri: "https://schema.org/DigitalDocument",
    mediaType: "application/octet-stream",
    byteSize,
    title: `Item ${id}`,
    description: "",
    modified: "2026-01-01T00:00:00.000Z",
    publisherWebId: webId,
  };
}

// Binds `byteSize` once to avoid passing it for each entry.
export function catalogEntryMaker(byteSize: number): (pod: string, webId: string, id: string) => CatalogAppend {
  return (pod, webId, id) => makeCatalogEntry(pod, webId, id, byteSize);
}

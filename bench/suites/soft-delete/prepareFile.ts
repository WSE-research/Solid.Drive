/**
 * @packageDocumentation
 * Creates one real file in a pod for a benchmark to work with.
 * it writes the file's content and metadata, adds it to the catalog, 
 * and can optionally fill the trash catalog to a given size first 
 * so the benchmark isn't empty for the run.
 */

import { appendToCatalog } from "@/infrastructure/solid/catalog";
import { getTrashCatalogUri } from "@/infrastructure/solid/trashPaths";
import { seedCatalog } from "../../lib/catalogWriteMethods";
import { toFetchFn, type AuthFetch } from "../../lib/auth";
import type { CatalogAppend } from "../../lib/buildN3Patch";
import { fileLayout, sizedBinary, indexTurtle, type FileDescriptor } from "./fileFixture";

export const CLASS_URI = "https://schema.org/DigitalDocument";
export const MEDIA_TYPE = "application/octet-stream";
export const MODIFIED = "2026-01-01T00:00:00.000Z";

export interface PreparedFile {
  descriptor: FileDescriptor;
  storageRoot: string;
  mainCatalogUri: string;
}

let fileCounter = 0;

// Creates a seed catalog entry with a unique layout for each index.
function seedEntry(storageRoot: string, webId: string, tag: string, index: number): CatalogAppend {
  const layout = fileLayout(storageRoot, `seed-${tag}-${index}`);
  return {
    catalogUri: "",
    instanceUri: layout.indexUri,
    binaryUri: layout.binaryUri,
    classUri: CLASS_URI,
    mediaType: MEDIA_TYPE,
    byteSize: 1024,
    title: `seed ${index}`,
    description: "",
    modified: MODIFIED,
    publisherWebId: webId,
  };
}

/**
 * Creates a file for the benchmark and optionally seeds its trash catalog.
 * Each call uses a separate storage location unless one is provided.
 */
export async function prepareFile(
  base: AuthFetch,
  pod: string,
  webId: string,
  sizeKb: number,
  trashSize: number,
  tag: string,
  storageRootOverride?: string,
): Promise<PreparedFile> {
  const id = fileCounter++;
  const storageRoot = storageRootOverride ?? `${pod}w${id}/`;
  const mainCatalogUri = `${storageRoot}catalog.ttl`;

  if (trashSize > 0) {
    await seedCatalog(base, getTrashCatalogUri(storageRoot), trashSize, (index) => seedEntry(storageRoot, webId, `${tag}-${id}`, index));
  }

  const slug = `${tag}-${id}`;
  const layout = fileLayout(storageRoot, slug);
  const byteSize = sizeKb * 1024;
  const descriptor: FileDescriptor = { layout, webId, byteSize, classUri: CLASS_URI, mediaType: MEDIA_TYPE, title: `bench-${slug}`, modified: MODIFIED };

  await base(layout.binaryUri, { method: "PUT", headers: { "content-type": MEDIA_TYPE }, body: sizedBinary(byteSize) });
  await base(layout.indexUri, { method: "PUT", headers: { "content-type": "text/turtle" }, body: indexTurtle(descriptor) });
  await appendToCatalog({
    catalogUri: mainCatalogUri, instanceUri: layout.indexUri, binaryUri: layout.binaryUri,
    classUri: CLASS_URI, parentUri: "", mediaType: MEDIA_TYPE, byteSize,
    title: descriptor.title, description: "", modified: MODIFIED, publisherWebId: webId, fetch: toFetchFn(base),
  });

  return { descriptor, storageRoot, mainCatalogUri };
}

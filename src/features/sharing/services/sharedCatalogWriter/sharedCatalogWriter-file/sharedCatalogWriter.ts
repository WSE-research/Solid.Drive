import { appendToCatalog } from "@/infrastructure/solid/catalog";
import { discoverAclUri, writeResourceAcl } from "@/infrastructure/wac/aclManager";
import { getSharedCatalogUri } from "@/infrastructure/solid/sharedCatalog";
import type { CatalogEntry, FetchFn, SharedEntry } from "@/types";

/**
 * Maps a {@link CatalogEntry} to the {@link SharedEntry} shape consumed
 * by {@link syncSharedCatalog}.
 *
 * @public
 */
export function catalogEntryToSharedEntry(entry: CatalogEntry): SharedEntry {
  return {
    metadataUri: entry.uri,
    binaryUri: entry.accessURL,
    classUri: entry.conformsTo,
    mediaType: entry.mediaType,
    byteSize: entry.byteSize,
    title: entry.title,
    description: entry.description,
    modified: entry.modified,
  };
}

interface SyncSharedCatalogParams {
  appContainerUri: string;
  contactWebId: string;
  ownerWebId: string;
  entries: readonly SharedEntry[];
  fetch: FetchFn;
}

/**
 * Writes the given entries to `<appContainerUri>.shared-<contact>.ttl`
 * and grants the contact read access to that catalog. Idempotent;
 * no-op on empty input.
 *
 * @public
 */
export async function syncSharedCatalog({
  appContainerUri,
  contactWebId,
  ownerWebId,
  entries,
  fetch,
}: SyncSharedCatalogParams): Promise<void> {
  if (entries.length === 0) return;
  const sharedCatalogUri = getSharedCatalogUri(appContainerUri, contactWebId);
  for (const entry of entries) {
    await appendToCatalog(
      sharedCatalogUri,
      entry.metadataUri,
      entry.binaryUri,
      entry.classUri,
      entry.mediaType,
      entry.byteSize,
      entry.title,
      entry.description,
      entry.modified,
      ownerWebId,
      fetch,
    );
  }
  const sharedCatalogAclUri = await discoverAclUri(sharedCatalogUri, fetch);
  await writeResourceAcl(
    sharedCatalogAclUri,
    sharedCatalogUri,
    ownerWebId,
    [contactWebId],
    fetch,
  );
}

/**
 * @packageDocumentation
 * Finds one specific row in a catalog by its dataset URI, instead of
 * parsing the whole document into a list a caller has to search itself.
 */

import { parseCatalog } from "@/infrastructure/solid/catalog";
import type { FetchFn, CatalogEntry } from "@/types";

/**
 * Reads a catalog and returns the entry whose `uri` matches
 * `instanceUri`, or `null` if the catalog can't be read or has no such
 * row.
 *
 * @public
 */
export async function findCatalogEntry(
  catalogUri: string,
  instanceUri: string,
  fetch: FetchFn,
): Promise<CatalogEntry | null> {
  const response = await fetch(catalogUri, { cache: "no-store" });
  if (!response.ok) return null;
  const entries = parseCatalog(await response.text(), catalogUri);
  return entries.find((entry) => entry.uri === instanceUri) ?? null;
}

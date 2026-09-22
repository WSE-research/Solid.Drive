/**
 * @packageDocumentation
 * Collects a folder's own catalog entry, if it has one, together with
 * every descendant entry reachable through `sd:hasParent` chains. Used
 * by `softDeleteFolder` to snapshot a subtree's catalog rows into a
 * trash catalog snapshot, and by `restoreTrashedFolder` to replay them back.
 */

import type { CatalogEntry } from "@/types";

/**
 * Returns `rootUri`'s own catalog entry (when it has one) followed by
 * every entry nested under it, at any depth, in breadth-first order.
 *
 * @remarks
 * Walks `parentUri` links rather than URI prefixes, since a folder's
 * catalog entry is identified by its own URI and every descendant's
 * `parentUri` points back to it, the same chain {@link FolderIndex}
 * walks for breadcrumbs. A folder with no catalog entry of its own
 * still yields its descendants: a bare, uncatalogued folder can still
 * contain catalogued files.
 *
 * A `parentUri` cycle (malformed data — a folder that is, directly or
 * transitively, its own ancestor) is broken rather than followed
 * forever: each URI is only ever visited once.
 *
 * @param entries - Every entry from the catalog the folder lives in.
 * @param rootUri - URI of the folder whose subtree should be collected.
 * @returns The root entry (if present) and all of its descendants.
 *
 * @public
 */
export function collectSubtreeCatalogEntries(entries: CatalogEntry[], rootUri: string): CatalogEntry[] {
  const rootEntry = entries.find((entry) => entry.uri === rootUri);
  const childrenByParent = new Map<string, CatalogEntry[]>();
  for (const entry of entries) {
    if (!entry.parentUri) continue;
    const siblings = childrenByParent.get(entry.parentUri);
    if (siblings) {
      siblings.push(entry);
    } else {
      childrenByParent.set(entry.parentUri, [entry]);
    }
  }

  const collected: CatalogEntry[] = rootEntry ? [rootEntry] : [];
  const visited = new Set<string>([rootUri]);
  const queue: string[] = [rootUri];
  while (queue.length > 0) {
    const parentUri = queue.shift()!;
    for (const child of childrenByParent.get(parentUri) ?? []) {
      if (visited.has(child.uri)) continue;
      visited.add(child.uri);
      collected.push(child);
      queue.push(child.uri);
    }
  }
  return collected;
}

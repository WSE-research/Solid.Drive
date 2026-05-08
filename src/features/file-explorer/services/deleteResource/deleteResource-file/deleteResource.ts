/**
 * Recursively deletes a Solid resource, container or leaf. Most Solid
 * pods reject `DELETE` on a non empty container, so the service walks
 * `ldp:contains` first, deletes every descendant, then deletes the
 * container itself. Catalog cleanup is best effort and silent failures
 * are acceptable, since folders aren't always catalogued.
 *
 * @packageDocumentation
 */

import { Parser } from 'n3';
import { removeFromCatalog } from '@/infrastructure/solid/catalog';
import type { FetchFn } from '@/types/solid';

const LDP_CONTAINS = 'http://www.w3.org/ns/ldp#contains';
const ACCEPT_TURTLE: HeadersInit = { Accept: 'text/turtle' };

/**
 * Result envelope. Callers receive `{ ok: false, reason }` so they can
 * surface the underlying server message without relying on thrown errors.
 *
 * @public
 */
export type DeleteResourceResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Arguments for {@link deleteResource}.
 *
 * @public
 */
export interface DeleteResourceArgs {
  /** Container URI to delete . */
  containerUri: string;
  /** Authenticated Solid fetch. */
  fetch: FetchFn;
  /**
   * Catalog URI. When provided alongside `metadataUri`, the entry is
   * removed from the catalog before the container is deleted.
   */
  catalogUri?: string;
  /** Metadata URI for catalog removal. */
  metadataUri?: string;
}

/**
 * Reads `ldp:contains` triples from a container's Turtle representation
 * and returns the absolute URIs of every immediate child. An empty list
 * is returned for any non-2xx response — callers should still attempt
 * the parent delete in that case, since the parent itself may be missing.
 */
async function listContainerChildren(
  containerUri: string,
  fetch: FetchFn,
): Promise<string[]> {
  const response = await fetch(containerUri, { headers: ACCEPT_TURTLE });
  if (!response.ok) return [];
  const text = await response.text();
  const parser = new Parser({ baseIRI: containerUri });
  const quads = parser.parse(text);
  return quads
    .filter((quad) => quad.predicate.value === LDP_CONTAINS)
    .map((quad) => quad.object.value);
}

/**
 * Hard deletes a Solid container and all of its descendants. See file
 * docs. Returns a result envelope rather than throwing.
 *
 * @public
 */
export async function deleteResource(
  args: DeleteResourceArgs,
): Promise<DeleteResourceResult> {
  if (args.catalogUri && args.metadataUri) {
    await removeFromCatalog(
      args.catalogUri,
      args.metadataUri,
      args.fetch,
    ).catch((error: unknown) => {
      // Catalog cleanup is best-effort: the container delete below is the
      // source of truth for whether the resource is gone. Swallow here so a
      // stale or already-removed catalog entry doesn't fail the user-facing
      // delete.
      void error;
    });
  }

  try {
    const children = await listContainerChildren(args.containerUri, args.fetch);
    for (const childUri of children) {
      const isContainer = childUri.endsWith('/');
      if (isContainer) {
        const childResult = await deleteResource({
          containerUri: childUri,
          fetch: args.fetch,
        });
        if (!childResult.ok) return childResult;
      } else {
        const response = await args.fetch(childUri, { method: 'DELETE' });
        if (!response.ok && response.status !== 404) {
          return {
            ok: false,
            reason: `${childUri}: ${response.status} ${response.statusText}`,
          };
        }
      }
    }

    const response = await args.fetch(args.containerUri, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) {
      return {
        ok: false,
        reason: `${response.status} ${response.statusText}`,
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

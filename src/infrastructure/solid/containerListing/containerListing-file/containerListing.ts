/**
 * @packageDocumentation
 * Reads the immediate children of a Solid container.
 */

import { Parser } from "n3";
import type { FetchFn } from "@/types";
import { RDF_NAMESPACES, CONTENT_TYPES } from "@/config";

const LDP_CONTAINS = `${RDF_NAMESPACES.LDP}contains`;
const ACCEPT_TURTLE: HeadersInit = { Accept: CONTENT_TYPES.TURTLE };

/**
 * Reads `ldp:contains` triples from a container's Turtle representation and
 * returns the absolute URIs of every immediate child.
 *
 * @remarks
 * Returns an empty list for any non-2xx response rather than throwing, so
 * callers can still attempt to act on the (possibly already-gone) parent.
 *
 * @public
 */
export async function listContainerChildren(containerUri: string, fetch: FetchFn): Promise<string[]> {
  const response = await fetch(containerUri, { headers: ACCEPT_TURTLE });
  if (!response.ok) return [];
  const text = await response.text();
  const parser = new Parser({ baseIRI: containerUri });
  let quads;
  try {
    quads = parser.parse(text);
  } catch {
    return [];
  }
  return quads.filter((quad) => quad.predicate.value === LDP_CONTAINS).map((quad) => quad.object.value);
}

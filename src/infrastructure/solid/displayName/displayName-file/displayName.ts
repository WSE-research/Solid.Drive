/**
 * Display name resolution from Solid profile documents.
 *
 * @packageDocumentation
 */

import { Parser } from "n3";
import type { FetchFn } from "@/types";
import { RDF_NAMESPACES, CONTENT_TYPES } from "@/config";

const FOAF_NAME = `${RDF_NAMESPACES.FOAF}name`;
const VCARD_FN = `${RDF_NAMESPACES.VCARD}fn`;

/**
 * Fetches a Solid profile document and returns the best available display name.
 *
 * @remarks
 * Checks predicates in order: `vcard:fn`, then `foaf:name`, then falls back to the WebID.
 *
 * @param webId - The user's WebID
 * @param fetchFn - Authenticated fetch function
 * @returns The resolved display name
 *
 * @public
 */
export async function resolveDisplayName(webId: string, fetchFn: FetchFn): Promise<string> {
  const profileDocUri = webId.split("#")[0];
  try {
    const response = await fetchFn(profileDocUri, { headers: { Accept: CONTENT_TYPES.TURTLE } });
    if (!response.ok) return webId;
    const turtle = await response.text();
    const quads = new Parser({ baseIRI: profileDocUri }).parse(turtle);
    const subject = webId;
    const fn = quads.find((quad) => quad.subject.value === subject && quad.predicate.value === VCARD_FN)?.object.value;
    if (fn) return fn;
    const name = quads.find((quad) => quad.subject.value === subject && quad.predicate.value === FOAF_NAME)?.object.value;
    if (name) return name;
  } catch {
    // Network or parse errors — fall back silently
  }
  return webId;
}

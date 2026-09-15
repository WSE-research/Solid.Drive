/**
 * @packageDocumentation
 * Provides recursive cleanup of benchmark containers and their contents.
 * This prevents benchmark data from accumulating between runs.
 */

import { Parser } from "n3";
import type { AuthFetch } from "./auth";

const LDP_CONTAINS = "http://www.w3.org/ns/ldp#contains";

/**
 * Recursively deletes a container and all of its members.
 * Members are deleted first because the container must be empty before
 * it can be removed.
 */
export async function purgeContainer(fetch: AuthFetch, containerUri: string): Promise<void> {
  const response = await fetch(containerUri, { headers: { accept: "text/turtle" } });
  // already gone, or not a container
  if (!response.ok) return; 
  const members = new Parser({ baseIRI: containerUri })
    .parse(await response.text())
    .filter((quad) => quad.predicate.value === LDP_CONTAINS)
    .map((quad) => quad.object.value);
  for (const member of members) {
    if (member.endsWith("/")) await purgeContainer(fetch, member);
    else await fetch(member, { method: "DELETE" }).catch(() => undefined);
  }
  await fetch(containerUri, { method: "DELETE" }).catch(() => undefined);
}

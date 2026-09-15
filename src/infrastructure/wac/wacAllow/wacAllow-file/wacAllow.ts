/**
 * @packageDocumentation
 * Reads the `WAC-Allow` response header to check whether the current agent
 * holds the access modes a soft delete needs, without a separate ACL read.
 */

import type { FetchFn } from "@/types";

/**
 * A Web Access Control mode as reported by `WAC-Allow`.
 *
 * @public
 */
export type WacAccessMode = "read" | "write" | "append" | "control";

/**
 * Parses the `user` group of a `WAC-Allow` response header into the set
 * of access modes granted to the current agent.
 *
 * @remarks
 * Header shape: `WAC-Allow: user="read write",public="read"`. Only the
 * `user` group reflects the authenticated agent's own grants.
 *
 * @param header - Raw `WAC-Allow` header value, or `null` when absent
 * @returns The modes granted to the `user` group, or an empty set when the
 * header is absent or has no `user` group.
 *
 * @public
 */
export function parseWacAllowModes(header: string | null): Set<WacAccessMode> {
  const userGroup = header
    ?.split(",")
    .map((group) => group.trim())
    .find((group) => group.startsWith("user="));
  if (!userGroup) return new Set();

  const modesText = userGroup.slice(userGroup.indexOf('"') + 1, userGroup.lastIndexOf('"'));
  return new Set(modesText.split(/\s+/).filter(Boolean) as WacAccessMode[]);
}

/**
 * Issues a `HEAD` request to `uri` and parses its `WAC-Allow` response header.
 *
 * @internal
 */
async function fetchWacAllowModes(uri: string, fetch: FetchFn): Promise<Set<WacAccessMode>> {
  const response = await fetch(uri, { method: "HEAD" });
  return parseWacAllowModes(response.headers.get("WAC-Allow"));
}

/**
 * True when the current agent can soft-delete `resourceUri` inside `containerUri`.
 *
 * @remarks
 * Requires Write and Control on the resource (needed to read and later
 * remove its ACL) and Write on the container (needed to remove the
 * resource's directory entry).
 *
 * @param resourceUri - URI of the file's binary payload
 * @param containerUri - URI of the file's container
 * @param fetch - Authenticated Solid fetch
 * @returns `true` when the agent holds all three required modes.
 *
 * @public
 */
export async function checkHasPermission(resourceUri: string, containerUri: string, fetch: FetchFn): Promise<boolean> {
  const [resourceModes, containerModes] = await Promise.all([
    fetchWacAllowModes(resourceUri, fetch),
    fetchWacAllowModes(containerUri, fetch),
  ]);
  return resourceModes.has("write") && resourceModes.has("control") && containerModes.has("write");
}

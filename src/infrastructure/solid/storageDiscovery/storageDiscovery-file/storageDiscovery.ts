/**
 * @packageDocumentation
 * Discovers the storage root of a Solid Pod by traversing upward from the 
 * user's WebID and examining the Link header with rel="type" for the pim:Storage 
 * type annotation.
 *
 * Community Solid Server pods do not expose the pim:storage property on user 
 * profiles, requiring an HTTP-based discovery approach. The algorithm traverses 
 * the resource hierarchy, bypassing intermediate containers that return 
 * authorization errors and identifies the nearest ancestor resource typed as a storage endpoint.
 * This ensures the discovery returns the user's Pod storage, not the server root.
 */

import { RDF_NAMESPACES } from "@/config";
import type { FetchFn } from "@/types";

const STORAGE_TYPE_URI = `${RDF_NAMESPACES.PIM}Storage`;
const LINK_TYPE_REL = "type";
const LINK_ENTRY_PATTERN = /<([^>]+)>\s*;\s*rel\s*=\s*"?([^",;]+)"?/gi;

const declaresStorageType = (linkHeader: string | null): boolean => {
  if (!linkHeader) return false;

  LINK_ENTRY_PATTERN.lastIndex = 0;
  let entry: RegExpExecArray | null;
  while ((entry = LINK_ENTRY_PATTERN.exec(linkHeader)) !== null) {
    const [, target, rel] = entry;
    if (rel.trim() === LINK_TYPE_REL && target === STORAGE_TYPE_URI) return true;
  }
  return false;
};

const withoutFragment = (uri: string): string | undefined => {
  try {
    const url = new URL(uri);
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
};

const parentContainer = (uri: string): string | undefined => {
  const url = new URL(uri);
  const path = url.pathname.replace(/\/+$/, "");
  if (path === "") return undefined;

  const lastSlash = path.lastIndexOf("/");
  url.pathname = path.slice(0, lastSlash + 1);
  url.search = "";
  url.hash = "";
  return url.toString();
};

const ensureTrailingSlash = (uri: string): string =>
  uri.endsWith("/") ? uri : `${uri}/`;

/**
 * Traverses upward from the WebID document to locate the nearest container
 * typed as pim:Storage. Returns undefined if no storage resource is found
 * before reaching the origin root.
 *
 * @param webId - The user's WebID URI
 * @param fetch - Authenticated fetch function
 * @public
 */
export const discoverStorageRoot = async (
  webId: string,
  fetch: FetchFn
): Promise<string | undefined> => {
  let current = withoutFragment(webId);
  const visited = new Set<string>();

  while (current && !visited.has(current)) {
    visited.add(current);
    try {
      const response = await fetch(current, { method: "HEAD" });
      if (declaresStorageType(response.headers.get("Link"))) {
        return ensureTrailingSlash(current);
      }
    } catch {
      // Unreadable intermediate --—> keep climbing.
    }
    current = parentContainer(current);
  }

  return undefined;
};

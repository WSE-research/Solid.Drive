/**
 * @packageDocumentation
 * GET-then-PUT copy of a single Solid resource, and container creation.
 * One implementation for both binaries and Turtle documents, shared by
 * `softDeleteFile` (original → trash) and `restoreTrashedFile` (trash →
 * original). Also copies whole container trees, for the folder equivalents.
 */

import type { FetchFn } from "@/types";
import { CONTENT_TYPES } from "@/config";
import { listContainerChildren } from "@/infrastructure/solid/containerListing";

/**
 * Copies a resource from `sourceUri` to `targetUri` via GET then PUT.
 *
 * @param fallbackContentType - Used when the source response carries no
 * `Content-Type` header.
 * @throws Error if the GET or the PUT fails.
 *
 * @public
 */
export async function copyResource(
  sourceUri: string,
  targetUri: string,
  fetch: FetchFn,
  fallbackContentType: string = CONTENT_TYPES.OCTET_STREAM,
): Promise<void> {
  const getResponse = await fetch(sourceUri);
  if (!getResponse.ok) {
    throw new Error(`Failed to read ${sourceUri}: ${getResponse.status} ${getResponse.statusText}`);
  }
  const contentType = getResponse.headers.get("Content-Type") ?? fallbackContentType;
  const body = await getResponse.blob();

  const putResponse = await fetch(targetUri, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
  if (!putResponse.ok) {
    throw new Error(`Failed to write ${targetUri}: ${putResponse.status} ${putResponse.statusText}`);
  }
}

/**
 * Ensures a container exists at `containerUri`, tolerating one that
 * already does (409).
 *
 * @throws Error if the PUT fails for any other reason.
 *
 * @public
 */
export async function ensureContainer(containerUri: string, fetch: FetchFn): Promise<void> {
  const response = await fetch(containerUri, {
    method: "PUT",
    headers: { "Content-Type": CONTENT_TYPES.TURTLE },
    body: "",
  });
  if (!response.ok && response.status !== 409) {
    throw new Error(`Failed to create container ${containerUri}: ${response.status} ${response.statusText}`);
  }
}

/**
 * Recursively copies everything under `sourceRootUri` to the same
 * relative path under `targetRootUri`, creating containers as needed.
 *
 * @remarks
 * Walks the live pod tree, not catalog data, so uncatalogued files and
 * subfolders get copied too.
 *
 * Throws instead of trusting a malformed `ldp:contains` listing: a child
 * outside its own container, or a container that lists itself again.
 * This is copying real data, so bad input doesn't get the benefit of
 * the doubt the way a read-only view could give it.
 *
 * @throws Error if a copy or container creation fails, a child isn't
 * nested under its own container, or the listing cycles.
 *
 * @public
 */
export async function copyContainerTree(sourceRootUri: string, targetRootUri: string, fetch: FetchFn): Promise<void> {
  await copyContainerTreeRecursive(sourceRootUri, targetRootUri, fetch, new Set([sourceRootUri]));
}

async function copyContainerTreeRecursive(
  sourceRootUri: string,
  targetRootUri: string,
  fetch: FetchFn,
  visitedContainers: Set<string>,
): Promise<void> {
  await ensureContainer(targetRootUri, fetch);

  const children = await listContainerChildren(sourceRootUri, fetch);
  for (const childUri of children) {
    if (!childUri.startsWith(sourceRootUri)) {
      throw new Error(
        `${sourceRootUri} lists a child (${childUri}) that isn't nested under it — refusing to copy it to a garbage relative path`
      );
    }
    const relativePath = childUri.slice(sourceRootUri.length);
    const targetUri = `${targetRootUri}${relativePath}`;
    if (childUri.endsWith("/")) {
      if (visitedContainers.has(childUri)) {
        throw new Error(`${sourceRootUri}'s listing cycles back to ${childUri} — refusing to copy forever`);
      }
      visitedContainers.add(childUri);
      await copyContainerTreeRecursive(childUri, targetUri, fetch, visitedContainers);
    } else {
      await copyResource(childUri, targetUri, fetch);
    }
  }
}

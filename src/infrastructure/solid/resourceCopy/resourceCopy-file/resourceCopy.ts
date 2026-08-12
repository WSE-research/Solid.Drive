/**
 * @packageDocumentation
 * GET-then-PUT copy of a single Solid resource, and container creation.
 * One implementation for both binaries and Turtle documents, shared by
 * `softDeleteFile` (original → trash) and `restoreTrashedFile` (trash →
 * original).
 */

import type { FetchFn } from "@/types";
import { CONTENT_TYPES } from "@/config";

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

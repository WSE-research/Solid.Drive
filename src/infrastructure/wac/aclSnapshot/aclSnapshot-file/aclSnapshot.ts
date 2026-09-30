/**
 * @packageDocumentation
 * Provides lossless snapshot and restore operations for resource ACLs.
 *
 * @remarks
 * ACL documents are preserved verbatim rather than reconstructed from parsed
 * permissions, which could omit grants such as `acl:Write`, `acl:Control`,
 * `acl:agentClass`, `acl:agentGroup`, or `acl:origin`.
 *
 * Restoring the original document to the same ACL URI also preserves the
 * meaning of any relative IRIs it contains.
 */

import type { FetchFn } from "@/types";
import { discoverAclUri, readAclDocument, writeAclDocument } from "@/infrastructure/wac/aclManager";

/**
 * Captures a resource's ACL document at the given snapshot URI.
 *
 * @param resourceUri - URI of the resource whose ACL should be captured.
 * @param snapshotUri - URI where the ACL snapshot should be stored.
 * @param fetch - Authenticated Solid fetch function.
 *
 * @returns `true` when the snapshot is written, or `false` when no ACL exists.
 * @throws If ACL discovery or writing the snapshot fails.
 *
 * @public
 */
export async function snapshotAcl(resourceUri: string, snapshotUri: string, fetch: FetchFn): Promise<boolean> {
  const aclUri = await discoverAclUri(resourceUri, fetch);
  const turtle = await readAclDocument(aclUri, fetch);
  if (turtle === null) return false;
  await writeAclDocument(snapshotUri, turtle, fetch);
  return true;
}

/**
 * Restores a previously captured ACL snapshot to a resource.
 *
 * @param snapshotUri - URI of the stored ACL snapshot.
 * @param resourceUri - URI of the resource whose ACL should be restored.
 * @param fetch - Authenticated Solid fetch function.
 *
 * @returns `true` when the ACL is restored, or `false` when no snapshot exists.
 * @throws If reading the snapshot, ACL discovery, or restoring the ACL fails.
 *
 * @public
 */
export async function restoreAclFromSnapshot(snapshotUri: string, resourceUri: string, fetch: FetchFn): Promise<boolean> {
  const response = await fetch(snapshotUri);
  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Error(`Failed to read ACL snapshot ${snapshotUri}: ${response.status} ${response.statusText}`);
  }
  const turtle = await response.text();

  const aclUri = await discoverAclUri(resourceUri, fetch);
  await writeAclDocument(aclUri, turtle, fetch);
  return true;
}

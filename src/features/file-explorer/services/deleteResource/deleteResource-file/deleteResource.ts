/**
 * Recursively hard-deletes Solid resources. Non-empty containers are
 * cleared by deleting their descendants first, then the container itself.
 * Catalog cleanup is best-effort because not all resources are catalogued.
 *
 * @packageDocumentation
 */

import { removeFromCatalog } from '@/infrastructure/solid/catalog';
import { listContainerChildren } from '@/infrastructure/solid/containerListing';
import { notifyCatalogChanged } from '@/shared/hooks/useCatalogVersion';
import type { FetchFn } from '@/types/solid';

/**
 * Result of a {@link deleteResource} operation.
 * 
 * Failed operations return their reason instead of throwing, allowing
 * callers to surface the underlying error.
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
  // Container URI to delete.
  containerUri: string;
  // Authenticated Solid fetch. 
  fetch: FetchFn;
  /**
   * Catalog URI containing the resource. When provided with
   * `metadataUri`, the catalog entry is removed before deletion.
   */
  catalogUri?: string;
  // Metadata URI for catalog removal.
  metadataUri?: string;
}

/**
 * Drops the companion `.acl` resource before deleting its resource.
 * Missing ACLs and deletion failures are ignored.
 * 
 * @internal
 */
async function dropCompanionAcl(uri: string, fetch: FetchFn): Promise<void> {
  await fetch(`${uri}.acl`, { method: 'DELETE' }).catch(() => {});
}

/**
 * Hard deletes a Solid container and all of its descendants. See file
 * docs. Returns a result envelope rather than throwing.
 * 
 * @param args - Resource and optional catalog information for the deletion.
 * @returns The deletion result, including the failure reason when unsuccessful.
 * 
 * @public
 */
export async function deleteResource(
  args: DeleteResourceArgs,
): Promise<DeleteResourceResult> {
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
        await dropCompanionAcl(childUri, args.fetch);
        const response = await args.fetch(childUri, { method: 'DELETE' });
        if (!response.ok && response.status !== 404) {
          return {
            ok: false,
            reason: `${childUri}: ${response.status} ${response.statusText}`,
          };
        }
      }
    }

    await dropCompanionAcl(args.containerUri, args.fetch);
    const response = await args.fetch(args.containerUri, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) {
      return {
        ok: false,
        reason: `${response.status} ${response.statusText}`,
      };
    }

    if (args.catalogUri && args.metadataUri) {
      await removeFromCatalog(
        args.catalogUri,
        args.metadataUri,
        args.fetch,
      ).catch((error: unknown) => {
        void error;
      });
      notifyCatalogChanged(args.catalogUri);
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Runs {@link deleteResource} as a best-effort cleanup operation,
 * suppressing failures when leftover resources are acceptable.
 *
 * Intended for rollback paths where another failure is already being handled.
 *
 * @param args - Resource and optional catalog information for the deletion.
 *
 * @public
 */
export async function deleteResourceQuietly(args: DeleteResourceArgs): Promise<void> {
  await deleteResource(args).catch(() => {});
}

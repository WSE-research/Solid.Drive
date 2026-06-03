/**
 * @packageDocumentation
 * Manages WAC permissions for sharing files with contacts.
 */

import { useState, useCallback } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { discoverAclUri, ensureDiscoveryAccess, readAclAgents, writeAcl } from "@/infrastructure/wac/aclManager";
import { removeFromCatalog } from "@/infrastructure/solid/catalog";
import { getSharedCatalogUri } from "@/infrastructure/solid/sharedCatalog";
import { syncSharedCatalog } from "@/features/sharing/services/sharedCatalogWriter";
import { notifyAclChanged } from "@/shared/hooks/useAclVersion";
import { notifySharedCatalogsChanged } from "@/shared/hooks/useSharedCatalogVersion";
import type { FetchFn, SharedEntry } from "@/types";

const toErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

/**
 * Number of times the initial ACL read is attempted. The first
 * authenticated request to a pod can reject with a network error while
 * the DPoP/token handshake warms up; retrying clears that transient.
 */
const ACL_READ_ATTEMPTS = 3;
const ACL_READ_RETRY_DELAY_MS = 300;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A rejected `fetch` surfaces as a `TypeError` ("NetworkError when
 * attempting to fetch resource."). HTTP error responses throw a plain
 * `Error`, which is meaningful (403/404) and must not be retried.
 */
const isTransientFetchError = (err: unknown): boolean => err instanceof TypeError;

/**
 * Discovers the container's ACL and reads its read-only grantees,
 * retrying only on transient network rejections.
 */
async function readGranteesWithRetry(
  containerUri: string,
  fetch: FetchFn,
): Promise<{ aclUri: string; grantees: string[] }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ACL_READ_ATTEMPTS; attempt += 1) {
    try {
      const aclUri = await discoverAclUri(containerUri, fetch);
      const grantees = await readAclAgents(aclUri, fetch);
      return { aclUri, grantees };
    } catch (err) {
      lastError = err;
      if (!isTransientFetchError(err) || attempt === ACL_READ_ATTEMPTS) throw err;
      await wait(ACL_READ_RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError;
}

interface UseAclManagerReturn {
  aclUri: string | null;
  grantees: string[];
  loading: boolean;
  error: string | null;
  isSaving: boolean;
  loadAcl: () => Promise<void>;
  grant: (contactWebId: string) => Promise<void>;
  revoke: (contactWebId: string) => Promise<void>;
}

/**
 * Grants and revokes file access via WAC ACLs and shared catalogs.
 *
 * @param containerUri - URI of the file's container
 * @param catalogUri - URI of the owner's main catalog
 * @param appContainerUri - URI of the app's container
 * @param ownerWebId - WebID of the file owner
 * @param sharedEntry - Metadata for the shared file
 *
 * @public
 */
export function useAclManager(
  containerUri: string,
  catalogUri: string,
  appContainerUri: string,
  ownerWebId: string,
  sharedEntry: SharedEntry
): UseAclManagerReturn {
  const { fetch: solidFetch } = useSolidAuth();
  const [aclUri, setAclUri] = useState<string | null>(null);
  const [grantees, setGrantees] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const writeSharedEntry = useCallback(
    (contactWebId: string) =>
      syncSharedCatalog({
        appContainerUri,
        contactWebId,
        ownerWebId,
        entries: [sharedEntry],
        fetch: solidFetch,
      }),
    [appContainerUri, ownerWebId, sharedEntry, solidFetch],
  );

  const loadAcl = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { aclUri: discoveredAclUri, grantees: currentGrantees } =
        await readGranteesWithRetry(containerUri, solidFetch);
      setAclUri(discoveredAclUri);
      setGrantees(currentGrantees);
      for (const contactWebId of currentGrantees) {
        await writeSharedEntry(contactWebId);
        await ensureDiscoveryAccess(catalogUri, appContainerUri, ownerWebId, contactWebId, solidFetch);
      }
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [appContainerUri, catalogUri, containerUri, ownerWebId, solidFetch, writeSharedEntry]);

  const grant = useCallback(async (contactWebId: string) => {
    if (!aclUri) return;
    setIsSaving(true);
    setError(null);
    try {
      const newGrantees = [...grantees, contactWebId];
      await writeAcl(aclUri, containerUri, ownerWebId, newGrantees, solidFetch);
      setGrantees(newGrantees);
      notifyAclChanged(containerUri);
      try {
        await writeSharedEntry(contactWebId);
        await ensureDiscoveryAccess(catalogUri, appContainerUri, ownerWebId, contactWebId, solidFetch);
        notifySharedCatalogsChanged();
      } catch (catalogErr) {
        setError(toErrorMessage(catalogErr));
      }
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }, [aclUri, appContainerUri, catalogUri, containerUri, grantees, ownerWebId, solidFetch, writeSharedEntry]);

  const revoke = useCallback(async (contactWebId: string) => {
    if (!aclUri) return;
    setIsSaving(true);
    setError(null);
    try {
      const newGrantees = grantees.filter((granteeWebId) => granteeWebId !== contactWebId);
      await writeAcl(aclUri, containerUri, ownerWebId, newGrantees, solidFetch);
      setGrantees(newGrantees);
      notifyAclChanged(containerUri);
      try {
        const sharedCatalogUri = getSharedCatalogUri(appContainerUri, contactWebId);
        await removeFromCatalog(sharedCatalogUri, sharedEntry.metadataUri, solidFetch);
        notifySharedCatalogsChanged();
      } catch (catalogErr) {
        setError(toErrorMessage(catalogErr));
      }
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }, [aclUri, appContainerUri, containerUri, grantees, ownerWebId, sharedEntry, solidFetch]);

  return { aclUri, grantees, loading, error, isSaving, loadAcl, grant, revoke };
}

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
import type { SharedEntry } from "@/types";

const toErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

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
      const discoveredAclUri = await discoverAclUri(containerUri, solidFetch);
      setAclUri(discoveredAclUri);
      const currentGrantees = await readAclAgents(discoveredAclUri, solidFetch);
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

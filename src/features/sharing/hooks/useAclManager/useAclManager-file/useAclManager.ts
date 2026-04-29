/**
 * @packageDocumentation
 * Manages WAC permissions for sharing files with contacts.
 */

import { useState, useCallback } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { discoverAclUri, ensureDiscoveryAccess, readAclAgents, writeAcl, writeResourceAcl } from "@/infrastructure/wac/aclManager";
import { appendToCatalog } from "@/infrastructure/solid/catalog";
import { getSharedCatalogUri } from "@/infrastructure/solid/sharedCatalog";
import type { SharedEntry } from "@/types";

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

  const syncSharedCatalog = useCallback(async (contactWebId: string) => {
    const sharedCatalogUri = getSharedCatalogUri(appContainerUri, contactWebId);
    await appendToCatalog(
      sharedCatalogUri,
      sharedEntry.metadataUri,
      sharedEntry.binaryUri,
      sharedEntry.classUri,
      sharedEntry.mediaType,
      sharedEntry.byteSize,
      sharedEntry.title,
      sharedEntry.description,
      sharedEntry.modified,
      ownerWebId,
      solidFetch
    );
    const sharedCatalogAclUri = await discoverAclUri(sharedCatalogUri, solidFetch);
    await writeResourceAcl(sharedCatalogAclUri, sharedCatalogUri, ownerWebId, [contactWebId], solidFetch);
  }, [appContainerUri, ownerWebId, sharedEntry, solidFetch]);

  const loadAcl = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const discoveredAclUri = await discoverAclUri(containerUri, solidFetch);
      setAclUri(discoveredAclUri);
      const currentGrantees = await readAclAgents(discoveredAclUri, solidFetch);
      setGrantees(currentGrantees);
      for (const contactWebId of currentGrantees) {
        await syncSharedCatalog(contactWebId);
        await ensureDiscoveryAccess(catalogUri, appContainerUri, ownerWebId, contactWebId, solidFetch);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [appContainerUri, catalogUri, containerUri, ownerWebId, solidFetch, syncSharedCatalog]);

  const grant = useCallback(async (contactWebId: string) => {
    if (!aclUri) return;
    setIsSaving(true);
    setError(null);
    try {
      const newGrantees = [...grantees, contactWebId];
      await writeAcl(aclUri, containerUri, ownerWebId, newGrantees, solidFetch);
      await syncSharedCatalog(contactWebId);
      await ensureDiscoveryAccess(catalogUri, appContainerUri, ownerWebId, contactWebId, solidFetch);
      setGrantees(newGrantees);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }, [aclUri, appContainerUri, catalogUri, containerUri, grantees, ownerWebId, solidFetch, syncSharedCatalog]);

  const revoke = useCallback(async (contactWebId: string) => {
    if (!aclUri) return;
    setIsSaving(true);
    setError(null);
    try {
      const newGrantees = grantees.filter((granteeWebId) => granteeWebId !== contactWebId);
      await writeAcl(aclUri, containerUri, ownerWebId, newGrantees, solidFetch);
      setGrantees(newGrantees);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }, [aclUri, containerUri, grantees, ownerWebId, solidFetch]);

  return { aclUri, grantees, loading, error, isSaving, loadAcl, grant, revoke };
}

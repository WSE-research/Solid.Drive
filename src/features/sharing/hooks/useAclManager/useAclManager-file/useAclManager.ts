/**
 * @packageDocumentation
 * Manages WAC permissions for sharing files with contacts.
 */

import { useState, useCallback } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { discoverAclUri, readAclAgents, writeAcl, writeListOnlyAcl, writeResourceAcl } from "@/infrastructure/wac/aclManager";
import { appendToCatalog, removeFromCatalog } from "@/infrastructure/solid/catalog";
import { getCandidateSharedCatalogUris, getSharedCatalogUri } from "@/infrastructure/solid/sharedCatalog";

interface SharedEntry {
  metadataUri: string;
  binaryUri: string;
  classUri: string;
  mediaType: string;
  byteSize: number;
  title: string;
  description: string;
  modified: string;
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

  const removeAgentsFromAcl = useCallback(async (
    resourceUri: string,
    agents: string[],
    writeFn: (aclUri: string, resourceUri: string, owner: string, remaining: string[], fetch: typeof solidFetch) => Promise<void>
  ) => {
    const aclUri = await discoverAclUri(resourceUri, solidFetch);
    const existing = await readAclAgents(aclUri, solidFetch);
    const remaining = existing.filter((webId) => !agents.includes(webId));
    if (remaining.length !== existing.length) {
      await writeFn(aclUri, resourceUri, ownerWebId, remaining, solidFetch);
    }
  }, [ownerWebId, solidFetch]);

  const removeLegacyDiscoveryAccess = useCallback(async (agents: string[]) => {
    if (agents.length === 0 || !ownerWebId) return;
    try {
      await removeAgentsFromAcl(appContainerUri, agents, writeListOnlyAcl);
    } catch {
      // legacy cleanup should not block the current share operation
    }
    try {
      await removeAgentsFromAcl(catalogUri, agents, writeResourceAcl);
    } catch {
      // legacy cleanup should not block the current share operation
    }
  }, [appContainerUri, catalogUri, ownerWebId, removeAgentsFromAcl]);

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
      }
      await removeLegacyDiscoveryAccess(currentGrantees);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [containerUri, removeLegacyDiscoveryAccess, solidFetch, syncSharedCatalog]);

  const grant = useCallback(async (contactWebId: string) => {
    if (!aclUri) return;
    setIsSaving(true);
    setError(null);
    try {
      const newGrantees = [...grantees, contactWebId];
      await writeAcl(aclUri, containerUri, ownerWebId, newGrantees, solidFetch);
      await syncSharedCatalog(contactWebId);
      await removeLegacyDiscoveryAccess([contactWebId]);
      setGrantees(newGrantees);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }, [aclUri, containerUri, grantees, ownerWebId, removeLegacyDiscoveryAccess, solidFetch, syncSharedCatalog]);

  const revoke = useCallback(async (contactWebId: string) => {
    if (!aclUri) return;
    setIsSaving(true);
    setError(null);
    try {
      const newGrantees = grantees.filter((granteeWebId) => granteeWebId !== contactWebId);
      await writeAcl(aclUri, containerUri, ownerWebId, newGrantees, solidFetch);
      for (const sharedCatalogUri of getCandidateSharedCatalogUris(appContainerUri, contactWebId)) {
        await removeFromCatalog(sharedCatalogUri, sharedEntry.metadataUri, solidFetch).catch(() => {});
      }
      setGrantees(newGrantees);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }, [aclUri, appContainerUri, containerUri, grantees, ownerWebId, sharedEntry.metadataUri, solidFetch]);

  return { aclUri, grantees, loading, error, isSaving, loadAcl, grant, revoke };
}

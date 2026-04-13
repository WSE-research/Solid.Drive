/**
 * @packageDocumentation
 * Handles incoming access requests from the user's inbox.
 */

import { useState, useEffect, useCallback } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { discoverInboxUri, listAccessRequests, deleteAccessRequest, postRejectionNotification } from "@/infrastructure/inbox/inboxAccess";
import type { AccessRequest } from "@/infrastructure/inbox/inboxAccess";
import { discoverAclUri, readAclAgents, writeResourceAcl, writeListOnlyAcl, writeAcl } from "@/infrastructure/wac/aclManager";
import { getAppContainerUri, getSharedCatalogUri } from "@/infrastructure/solid/sharedCatalog";
import { EMPTY_CATALOG_TURTLE } from "@/infrastructure/solid/catalog";
import { CONTENT_TYPES } from "@/config";
import type { FetchFn } from "@/types";

async function ensureEmptySharedCatalog(uri: string, fetch: FetchFn): Promise<void> {
  const check = await fetch(uri, { method: "HEAD" });
  if (check.ok) return;
  const response = await fetch(uri, {
    method: "PUT",
    headers: { "Content-Type": CONTENT_TYPES.TURTLE },
    body: EMPTY_CATALOG_TURTLE,
  });
  if (!response.ok) {
    throw new Error(`Failed to create shared catalog at ${uri}: ${response.status} ${response.statusText}`);
  }
}

interface UseAccessRequestsReturn {
  requests: AccessRequest[];
  loading: boolean;
  error: string | null;
  busyMessageUri: string | null;
  loadRequests: () => Promise<void>;
  approve: (request: AccessRequest) => Promise<void>;
  deny: (request: AccessRequest) => Promise<void>;
}

/**
 * Lists, approves, and denies access requests from the user's inbox.
 *
 * @param ownerWebId - WebID of the resource owner
 * @param storageRoot - Root URI of the user's Pod storage
 * @param catalogUri - URI of the user's file catalog
 *
 * @public
 */
export function useAccessRequests(
  ownerWebId: string,
  storageRoot: string,
  catalogUri: string
): UseAccessRequestsReturn {
  const { fetch: solidFetch } = useSolidAuth();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyMessageUri, setBusyMessageUri] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const inboxUri = await discoverInboxUri(ownerWebId, solidFetch);
      const found = await listAccessRequests(inboxUri, solidFetch);
      setRequests(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [ownerWebId, solidFetch]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const approve = useCallback(async (request: AccessRequest) => {
    setBusyMessageUri(request.messageUri);
    setError(null);
    try {
      const appContainerUri = getAppContainerUri(storageRoot);

      if (request.requestType === "catalog") {
        const sharedCatalogUri = getSharedCatalogUri(appContainerUri, request.requesterWebId);
        await ensureEmptySharedCatalog(sharedCatalogUri, solidFetch);

        const sharedCatalogAclUri = await discoverAclUri(sharedCatalogUri, solidFetch);
        await writeResourceAcl(sharedCatalogAclUri, sharedCatalogUri, ownerWebId, [request.requesterWebId], solidFetch);

        const catalogAclUri = await discoverAclUri(catalogUri, solidFetch);
        const existingCatalogAgents = await readAclAgents(catalogAclUri, solidFetch);
        if (!existingCatalogAgents.includes(request.requesterWebId)) {
          await writeResourceAcl(catalogAclUri, catalogUri, ownerWebId, [...existingCatalogAgents, request.requesterWebId], solidFetch);
        }

        const appAclUri = await discoverAclUri(appContainerUri, solidFetch);
        const existingAppAgents = await readAclAgents(appAclUri, solidFetch);
        if (!existingAppAgents.includes(request.requesterWebId)) {
          await writeListOnlyAcl(appAclUri, appContainerUri, ownerWebId, [...existingAppAgents, request.requesterWebId], solidFetch);
        }
      } else {
        const fileAclUri = await discoverAclUri(request.accessTo, solidFetch);
        const existingFileAgents = await readAclAgents(fileAclUri, solidFetch);
        if (!existingFileAgents.includes(request.requesterWebId)) {
          await writeAcl(fileAclUri, request.accessTo, ownerWebId, [...existingFileAgents, request.requesterWebId], solidFetch);
        }
      }

      await deleteAccessRequest(request.messageUri, solidFetch);
      setRequests((prev) => prev.filter((existingRequest) => existingRequest.messageUri !== request.messageUri));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyMessageUri(null);
    }
  }, [ownerWebId, storageRoot, catalogUri, solidFetch]);

  const deny = useCallback(async (request: AccessRequest) => {
    setBusyMessageUri(request.messageUri);
    setError(null);
    try {
      try {
        const requesterInboxUri = await discoverInboxUri(request.requesterWebId, solidFetch);
        await postRejectionNotification(requesterInboxUri, request.accessTo, solidFetch);
      } catch {
        // best-effort
      }
      await deleteAccessRequest(request.messageUri, solidFetch);
      setRequests((prev) => prev.filter((existingRequest) => existingRequest.messageUri !== request.messageUri));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyMessageUri(null);
    }
  }, [solidFetch]);

  return { requests, loading, error, busyMessageUri, loadRequests, approve, deny };
}

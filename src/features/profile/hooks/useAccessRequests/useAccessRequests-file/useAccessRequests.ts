/**
 * @packageDocumentation
 * Handles incoming access requests from the user's inbox.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import {
  discoverInboxUri,
  listAccessRequests,
  deleteAccessRequest,
  postRejectionNotification,
  postApprovalNotification,
} from "@/infrastructure/inbox/inboxAccess";
import type { AccessRequest } from "@/infrastructure/inbox/inboxAccess";
import {
  discoverAclUri,
  ensureDiscoveryAccess,
  grantContainerReadAccess,
  writeResourceAcl,
} from "@/infrastructure/wac/aclManager";
import {
  getAppContainerUri,
  getSharedCatalogUri,
  toContainerUri,
} from "@/infrastructure/solid/sharedCatalog";
import { EMPTY_CATALOG_TURTLE, parseCatalog } from "@/infrastructure/solid/catalog";
import {
  catalogEntryToSharedEntry,
  syncSharedCatalog,
} from "@/features/sharing/services/sharedCatalogWriter";
import { CONTENT_TYPES } from "@/config";
import type { CatalogEntry, FetchFn } from "@/types";

const dedupeKey = (request: AccessRequest): string =>
  `${request.requestType}|${request.requesterWebId}|${request.accessTo}|${request.forClass ?? ""}`;

const isOlder = (candidate: AccessRequest, existing: AccessRequest): boolean =>
  (candidate.timestamp ?? "") < (existing.timestamp ?? "");

function dedupeAccessRequests(requests: readonly AccessRequest[]): AccessRequest[] {
  const oldestByKey = new Map<string, AccessRequest>();
  for (const request of requests) {
    const key = dedupeKey(request);
    const existing = oldestByKey.get(key);
    if (!existing || isOlder(request, existing)) {
      oldestByKey.set(key, request);
    }
  }
  return Array.from(oldestByKey.values());
}

async function ensureEmptySharedCatalog(uri: string, fetch: FetchFn): Promise<void> {
  const check = await fetch(uri, { method: "HEAD" });
  if (check.ok) return;
  const response = await fetch(uri, {
    method: "PUT",
    headers: { "Content-Type": CONTENT_TYPES.TURTLE },
    body: EMPTY_CATALOG_TURTLE,
  });
  if (!response.ok) {
    throw new Error(
      `Failed to create shared catalog at ${uri}: ${response.status} ${response.statusText}`,
    );
  }
}

async function grantCatalogAccess(
  request: AccessRequest,
  appContainerUri: string,
  ownerWebId: string,
  fetch: FetchFn,
): Promise<void> {
  const sharedCatalogUri = getSharedCatalogUri(appContainerUri, request.requesterWebId);
  await ensureEmptySharedCatalog(sharedCatalogUri, fetch);
  const sharedCatalogAclUri = await discoverAclUri(sharedCatalogUri, fetch);
  await writeResourceAcl(
    sharedCatalogAclUri,
    sharedCatalogUri,
    ownerWebId,
    [request.requesterWebId],
    fetch,
  );
}

async function readCatalogEntries(catalogUri: string, fetch: FetchFn): Promise<CatalogEntry[]> {
  const response = await fetch(catalogUri);
  if (!response.ok) {
    throw new Error(
      `Failed to read catalog at ${catalogUri}: ${response.status} ${response.statusText}`,
    );
  }
  return parseCatalog(await response.text(), catalogUri);
}

async function grantTypeAccess(
  request: AccessRequest,
  catalogUri: string,
  appContainerUri: string,
  ownerWebId: string,
  fetch: FetchFn,
): Promise<void> {
  const entries = await readCatalogEntries(catalogUri, fetch);
  const matching = entries.filter((entry) => entry.conformsTo === request.forClass);

  const granted: CatalogEntry[] = [];
  const failures: unknown[] = [];
  for (const entry of matching) {
    try {
      await grantContainerReadAccess(
        toContainerUri(entry.uri),
        ownerWebId,
        request.requesterWebId,
        fetch,
      );
      granted.push(entry);
    } catch (err) {
      failures.push(err);
    }
  }
  await syncSharedCatalog({
    appContainerUri,
    contactWebId: request.requesterWebId,
    ownerWebId,
    entries: granted.map(catalogEntryToSharedEntry),
    fetch,
  });
  if (matching.length > 0 && granted.length === 0) {
    const first = failures[0];
    throw first instanceof Error ? first : new Error(String(first));
  }
}

async function grantFileAccess(
  request: AccessRequest,
  catalogUri: string,
  appContainerUri: string,
  ownerWebId: string,
  fetch: FetchFn,
): Promise<void> {
  await grantContainerReadAccess(
    request.accessTo,
    ownerWebId,
    request.requesterWebId,
    fetch,
  );
  const entries = await readCatalogEntries(catalogUri, fetch);
  const entry = entries.find((candidate) => toContainerUri(candidate.uri) === request.accessTo);
  if (entry) {
    await syncSharedCatalog({
      appContainerUri,
      contactWebId: request.requesterWebId,
      ownerWebId,
      entries: [catalogEntryToSharedEntry(entry)],
      fetch,
    });
  }
}

const toErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

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
  catalogUri: string,
): UseAccessRequestsReturn {
  const { fetch: solidFetch } = useSolidAuth();
  const [allRequests, setAllRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyMessageUri, setBusyMessageUri] = useState<string | null>(null);

  const allRequestsRef = useRef<AccessRequest[]>([]);
  useEffect(() => {
    allRequestsRef.current = allRequests;
  }, [allRequests]);

  const requests = useMemo(() => dedupeAccessRequests(allRequests), [allRequests]);

  const findDuplicateMessageUris = useCallback((request: AccessRequest): string[] => {
    const key = dedupeKey(request);
    return allRequestsRef.current
      .filter((candidate) => dedupeKey(candidate) === key)
      .map((candidate) => candidate.messageUri);
  }, []);

  const deleteAndPrune = useCallback(
    async (request: AccessRequest): Promise<void> => {
      const uris = findDuplicateMessageUris(request);
      await Promise.all(uris.map((uri) => deleteAccessRequest(uri, solidFetch)));
      const deleted = new Set(uris);
      setAllRequests((prev) =>
        prev.filter((existing) => !deleted.has(existing.messageUri)),
      );
    },
    [findDuplicateMessageUris, solidFetch],
  );

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const inboxUri = await discoverInboxUri(ownerWebId, solidFetch);
      setAllRequests(await listAccessRequests(inboxUri, solidFetch));
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [ownerWebId, solidFetch]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const approve = useCallback(
    async (request: AccessRequest) => {
      setBusyMessageUri(request.messageUri);
      setError(null);
      try {
        const appContainerUri = getAppContainerUri(storageRoot);

        if (request.requestType === "catalog") {
          await grantCatalogAccess(request, appContainerUri, ownerWebId, solidFetch);
        } else if (request.requestType === "type") {
          await grantTypeAccess(request, catalogUri, appContainerUri, ownerWebId, solidFetch);
        } else {
          await grantFileAccess(request, catalogUri, appContainerUri, ownerWebId, solidFetch);
        }

        await ensureDiscoveryAccess(
          catalogUri,
          appContainerUri,
          ownerWebId,
          request.requesterWebId,
          solidFetch,
        );

        try {
          const requesterInboxUri = await discoverInboxUri(request.requesterWebId, solidFetch);
          await postApprovalNotification(requesterInboxUri, request.accessTo, solidFetch);
        } catch {
          /* best-effort: requester inbox may not be reachable */
        }

        await deleteAndPrune(request);
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setBusyMessageUri(null);
      }
    },
    [ownerWebId, storageRoot, catalogUri, solidFetch, deleteAndPrune],
  );

  const deny = useCallback(
    async (request: AccessRequest) => {
      setBusyMessageUri(request.messageUri);
      setError(null);
      try {
        try {
          const requesterInboxUri = await discoverInboxUri(
            request.requesterWebId,
            solidFetch,
          );
          await postRejectionNotification(requesterInboxUri, request.accessTo, solidFetch);
        } catch {
          /* best-effort: requester inbox may not be reachable */
        }
        await deleteAndPrune(request);
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setBusyMessageUri(null);
      }
    },
    [solidFetch, deleteAndPrune],
  );

  return { requests, loading, error, busyMessageUri, loadRequests, approve, deny };
}

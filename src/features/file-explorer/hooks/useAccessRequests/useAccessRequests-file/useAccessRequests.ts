/**
 * Hook for sending per-file and per-type access requests to a contact's
 * inbox. A request is marked pending optimistically so the row reads
 * "Pending…" instantly; a failure rolls it back and flags the file for a
 * retry. Approval and denial are resolved by the row via
 * {@link useRequestStatus}, not here.
 *
 * @packageDocumentation
 */

import { useCallback, useState } from "react";
import type { CatalogEntry } from "@/types";
import { toContainerUri } from "@/infrastructure/solid/sharedCatalog";
import { discoverInboxUri, postFileAccessRequest, postTypeAccessRequest, deleteAccessRequest } from "@/infrastructure/inbox/inboxAccess";
import { usePendingRequests } from "@/shared/hooks/usePendingRequests";

type UseAccessRequestsParams = {
  contactWebId: string;
  viewerWebId: string;
  solidFetch: typeof fetch;
  entries: CatalogEntry[];
  /** Schema.org class URI of the category these entries belong to. */
  classUri: string;
  onClearOutcome: (containerUri: string) => void;
};

type UseAccessRequestsResult = {
  /** Every browsable entry in this folder has an outstanding request. */
  allPending: boolean;
  /** Container URIs whose last request attempt failed. */
  failedUris: ReadonlySet<string>;
  handleRequestAll: () => Promise<void>;
  handleRequestFile: (entry: CatalogEntry) => Promise<void>;
  handleRequestAgain: (entry: CatalogEntry, outcomeMessageUri: string | undefined) => Promise<void>;
};

/**
 * Manages bulk and per-file access request actions for one type folder.
 *
 * @public
 */
export function useFileAccessRequests({
  contactWebId,
  viewerWebId,
  solidFetch,
  entries,
  classUri,
  onClearOutcome,
}: UseAccessRequestsParams): UseAccessRequestsResult {
  const { isPending, markPending, clearPending } = usePendingRequests();
  const [failedUris, setFailedUris] = useState<ReadonlySet<string>>(new Set());

  const setFailed = useCallback((containerUri: string, failed: boolean) => {
    setFailedUris((prev) => {
      const next = new Set(prev);
      if (failed) next.add(containerUri);
      else next.delete(containerUri);
      return next;
    });
  }, []);

  const send = useCallback(async (containerUri: string) => {
    setFailed(containerUri, false);
    markPending(containerUri);
    try {
      const inboxUri = await discoverInboxUri(contactWebId, solidFetch);
      await postFileAccessRequest(inboxUri, viewerWebId, containerUri, solidFetch);
    } catch {
      clearPending(containerUri);
      setFailed(containerUri, true);
    }
  }, [contactWebId, viewerWebId, solidFetch, markPending, clearPending, setFailed]);

  const handleRequestFile = useCallback(
    (entry: CatalogEntry) => send(toContainerUri(entry.uri)),
    [send],
  );

  const handleRequestAll = useCallback(async () => {
    const containerUris = entries.map((entry) => toContainerUri(entry.uri));
    containerUris.forEach((containerUri) => {
      setFailed(containerUri, false);
      markPending(containerUri);
    });
    try {
      const inboxUri = await discoverInboxUri(contactWebId, solidFetch);
      await postTypeAccessRequest(inboxUri, viewerWebId, classUri, solidFetch);
    } catch {
      containerUris.forEach((containerUri) => {
        clearPending(containerUri);
        setFailed(containerUri, true);
      });
    }
  }, [contactWebId, viewerWebId, entries, classUri, solidFetch, markPending, clearPending, setFailed]);

  const handleRequestAgain = useCallback(async (entry: CatalogEntry, outcomeMessageUri: string | undefined) => {
    const containerUri = toContainerUri(entry.uri);
    if (outcomeMessageUri) {
      try {
        await deleteAccessRequest(outcomeMessageUri, solidFetch);
      } catch {
        // cleanup is best effort, proceed regardless
      }
    }
    onClearOutcome(containerUri);
    await send(containerUri);
  }, [solidFetch, onClearOutcome, send]);

  const allPending = entries.length > 0 && entries.every((entry) => isPending(toContainerUri(entry.uri)));

  return { allPending, failedUris, handleRequestAll, handleRequestFile, handleRequestAgain };
}

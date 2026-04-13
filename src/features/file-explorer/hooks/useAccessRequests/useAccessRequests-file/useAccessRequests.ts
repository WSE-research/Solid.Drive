/**
 * Hook for sending and tracking per-file access requests to a contact's inbox.
 *
 * @packageDocumentation
 */

import { useState, useCallback } from "react";
import type { CatalogEntry } from "@/types";
import { toContainerUri } from "@/infrastructure/solid/sharedCatalog";
import { discoverInboxUri, postFileAccessRequest, deleteAccessRequest } from "@/infrastructure/inbox/inboxAccess";
import type { AccessRejection } from "@/infrastructure/inbox/inboxAccess";

export type RequestStatus = "idle" | "sending" | "sent" | "error";

type UseAccessRequestsParams = {
  contactWebId: string;
  viewerWebId: string;
  solidFetch: typeof fetch;
  entries: CatalogEntry[];
  onClearRejection: (containerUri: string) => void;
};

type UseAccessRequestsResult = {
  bulkStatus: RequestStatus;
  fileStatuses: Record<string, RequestStatus>;
  handleRequestAll: () => Promise<void>;
  handleRequestFile: (entry: CatalogEntry) => Promise<void>;
  handleRequestAgain: (entry: CatalogEntry, rejection: AccessRejection) => Promise<void>;
};

/**
 * Manages bulk and per-file access request state and actions.
 * Sends notifications to the contact's inbox and tracks send status
 * for both individual files and the entire type folder.
 *
 * @public
 */
export function useAccessRequests({
  contactWebId,
  viewerWebId,
  solidFetch,
  entries,
  onClearRejection,
}: UseAccessRequestsParams): UseAccessRequestsResult {
  const [bulkStatus, setBulkStatus] = useState<RequestStatus>("idle");
  const [fileStatuses, setFileStatuses] = useState<Record<string, RequestStatus>>({});

  const sendRequest = useCallback(async (containerUri: string, entryUri: string) => {
    setFileStatuses((prev) => ({ ...prev, [entryUri]: "sending" }));
    try {
      const inboxUri = await discoverInboxUri(contactWebId, solidFetch);
      await postFileAccessRequest(inboxUri, viewerWebId, containerUri, solidFetch);
      setFileStatuses((prev) => ({ ...prev, [entryUri]: "sent" }));
    } catch {
      setFileStatuses((prev) => ({ ...prev, [entryUri]: "error" }));
    }
  }, [contactWebId, viewerWebId, solidFetch]);

  const handleRequestAll = useCallback(async () => {
    setBulkStatus("sending");
    try {
      const inboxUri = await discoverInboxUri(contactWebId, solidFetch);
      await Promise.all(
        entries.map((entry) =>
          postFileAccessRequest(inboxUri, viewerWebId, toContainerUri(entry.uri), solidFetch)
        )
      );
      setBulkStatus("sent");
    } catch {
      setBulkStatus("error");
    }
  }, [contactWebId, viewerWebId, entries, solidFetch]);

  const handleRequestFile = useCallback(async (entry: CatalogEntry) => {
    await sendRequest(toContainerUri(entry.uri), entry.uri);
  }, [sendRequest]);

  const handleRequestAgain = useCallback(async (entry: CatalogEntry, rejection: AccessRejection) => {
    const containerUri = toContainerUri(entry.uri);
    try {
      await deleteAccessRequest(rejection.messageUri, solidFetch);
    } catch {
      // cleanup — best effort, proceed regardless
    }
    onClearRejection(containerUri);
    await sendRequest(containerUri, entry.uri);
  }, [solidFetch, onClearRejection, sendRequest]);

  return { bulkStatus, fileStatuses, handleRequestAll, handleRequestFile, handleRequestAgain };
}

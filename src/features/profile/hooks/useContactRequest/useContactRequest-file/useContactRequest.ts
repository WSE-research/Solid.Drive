/**
 * Owns the catalog access-request action for a single contact: posts the
 * request, and re-requests after a decision. The request is marked
 * pending optimistically so the row reads "Pending…" instantly; a failure
 * rolls that back. Re-requesting deletes the previous outcome notice
 * (approval or rejection) so the row returns to Pending and the owner
 * sees a fresh request — the request → decision → re-request loop.
 *
 * @packageDocumentation
 */

import { useCallback, useState } from 'react';
import { deleteAccessRequest, discoverInboxUri, postCatalogAccessRequest } from '@/infrastructure/inbox/inboxAccess';
import { usePendingRequests } from '@/shared/hooks/usePendingRequests';

export interface UseContactRequestArgs {
  webId: string;
  ownerWebId: string;
  solidFetch: (url: RequestInfo, init?: RequestInit) => Promise<Response>;
  /** Inbox URI of the current approval/rejection notice for this contact, if any. */
  outcomeMessageUri: string | undefined;
  /** Drops the contact's outcome locally once its notice has been deleted. */
  onClearOutcome: () => void;
}

export interface UseContactRequestReturn {
  failed: boolean;
  request: () => Promise<void>;
  requestAgain: () => Promise<void>;
}

/**
 * @public
 */
export function useContactRequest({
  webId,
  ownerWebId,
  solidFetch,
  outcomeMessageUri,
  onClearOutcome,
}: UseContactRequestArgs): UseContactRequestReturn {
  const { markPending, clearPending } = usePendingRequests();
  const [failed, setFailed] = useState(false);

  const request = useCallback(async () => {
    setFailed(false);
    markPending(webId);
    try {
      const inboxUri = await discoverInboxUri(webId, solidFetch);
      await postCatalogAccessRequest(inboxUri, ownerWebId, webId, solidFetch);
    } catch {
      clearPending(webId);
      setFailed(true);
    }
  }, [webId, ownerWebId, solidFetch, markPending, clearPending]);

  const requestAgain = useCallback(async () => {
    if (outcomeMessageUri) {
      try {
        await deleteAccessRequest(outcomeMessageUri, solidFetch);
      } catch {
        // Cleanup failure is non-critical — the user-facing retry still proceeds.
      }
    }
    onClearOutcome();
    await request();
  }, [outcomeMessageUri, solidFetch, onClearOutcome, request]);

  return { failed, request, requestAgain };
}

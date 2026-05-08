/**
 * Owns the access-request lifecycle for a single contact row: discovers
 * the contact's inbox, posts the catalog access request, retries after
 * rejection, and exposes a small status state. Lifted out of `ContactRow`
 * so the component stays presentational.
 *
 * @packageDocumentation
 */

import { useCallback, useState } from 'react';
import {
  deleteAccessRequest,
  discoverInboxUri,
  postCatalogAccessRequest,
  type AccessRejection,
} from '@/infrastructure/inbox/inboxAccess';

export type RequestStatus = 'idle' | 'sending' | 'sent' | 'error';

export interface UseContactRequestArgs {
  webId: string;
  ownerWebId: string;
  solidFetch: (url: RequestInfo, init?: RequestInit) => Promise<Response>;
  rejection: AccessRejection | undefined;
  onClearRejection: () => void;
}

export interface UseContactRequestReturn {
  status: RequestStatus;
  requestAccess: () => Promise<void>;
  requestAgain: () => Promise<void>;
}

/**
 * @public
 */
export function useContactRequest({
  webId,
  ownerWebId,
  solidFetch,
  rejection,
  onClearRejection,
}: UseContactRequestArgs): UseContactRequestReturn {
  const [status, setStatus] = useState<RequestStatus>('idle');

  const requestAccess = useCallback(async () => {
    setStatus('sending');
    try {
      const inboxUri = await discoverInboxUri(webId, solidFetch);
      await postCatalogAccessRequest(inboxUri, ownerWebId, webId, solidFetch);
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }, [webId, ownerWebId, solidFetch]);

  const requestAgain = useCallback(async () => {
    /* v8 ignore next 2 */
    if (!rejection) return;
    try {
      await deleteAccessRequest(rejection.messageUri, solidFetch);
    } catch {
      // Cleanup failure is non-critical — the user-facing retry still proceeds.
    }
    onClearRejection();
    setStatus('idle');
    await requestAccess();
  }, [rejection, solidFetch, onClearRejection, requestAccess]);

  return { status, requestAccess, requestAgain };
}

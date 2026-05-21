/**
 * Provider component for the request-notifications feature.
 *
 * Wraps {@link useAccessRequests} so the bell badge, the toast
 * pipeline, and {@link RequestsList} all share a single source of
 * truth. Opens a Solid Notifications Protocol WebSocket on the user's
 * inbox so new requests surface the instant the server receives them
 * — no polling. A focus + visibilitychange listener still triggers a
 * one-shot refresh so changes made while the tab was hidden (or
 * before the subscription opened) get reconciled.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import { useSolidAuth } from '@ldo/solid-react';
import { useAccessRequests } from '@/features/profile/hooks/useAccessRequests';
import { useSeenRequests } from '@/features/profile/hooks/useSeenRequests';
import { discoverInboxUri } from '@/infrastructure/inbox/inboxAccess';
import {
  subscribeToInbox,
  type InboxSubscriptionHandle,
} from '@/infrastructure/inbox/inboxSubscription';
import type { AccessRequest } from '@/infrastructure/inbox/inboxAccess';
import {
  RequestNotificationsContext,
  type RequestNotificationsContextValue,
} from './requestNotificationsContextValue';
import { RequestToastFirer } from './RequestToastFirer';

interface RequestNotificationsProviderProps {
  ownerWebId: string;
  storageRoot: string;
  catalogUri: string;
  children: ReactNode;
}

/**
 * Wires {@link useAccessRequests} into a shared context, opens a Solid
 * Notifications WebSocket subscription on the user's inbox so changes
 * stream in real time, and schedules a per-request toast that
 * resolves the sender's profile before firing.
 *
 * @public
 */
export const RequestNotificationsProvider: FunctionComponent<
  RequestNotificationsProviderProps
> = ({ ownerWebId, storageRoot, catalogUri, children }) => {
  const { fetch: solidFetch } = useSolidAuth();
  const {
    requests,
    loading,
    error,
    busyMessageUri,
    loadRequests,
    approve,
    deny,
  } = useAccessRequests(ownerWebId, storageRoot, catalogUri);
  const { seenIds, isSeen, markSeen } = useSeenRequests();
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [navigationCount, setNavigationCount] = useState(0);
  const [pendingToasts, setPendingToasts] = useState<AccessRequest[]>([]);

  const mountedAtRef = useRef<number | null>(null);
  mountedAtRef.current ??= Date.now();
  const toastedIdsRef = useRef<Set<string>>(new Set());
  const seenIdsRef = useRef(seenIds);
  useEffect(() => {
    seenIdsRef.current = seenIds;
  }, [seenIds]);

  useEffect(() => {
    if (!ownerWebId) return;

    let cancelled = false;
    let handle: InboxSubscriptionHandle | null = null;

    const openSubscription = async () => {
      try {
        const inboxUri = await discoverInboxUri(ownerWebId, solidFetch);
        if (cancelled) return;
        handle = await subscribeToInbox(inboxUri, solidFetch, () => {
          void loadRequests();
        });
        if (cancelled) handle.close();
      } catch {
        /* no notification channel: focus refresh below is the only
           reconciliation path until the user reloads */
      }
    };

    void openSubscription();

    return () => {
      cancelled = true;
      handle?.close();
    };
  }, [ownerWebId, solidFetch, loadRequests]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadRequests();
      }
    };
    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [loadRequests]);

  useEffect(() => {
    const mountedAt = mountedAtRef.current ?? Date.now();
    const newlyArrived = requests.filter((request) => {
      if (toastedIdsRef.current.has(request.messageUri)) return false;
      if (seenIdsRef.current.has(request.messageUri)) return false;
      const timestamp = request.timestamp ? new Date(request.timestamp).getTime() : 0;
      return timestamp >= mountedAt;
    });

    if (newlyArrived.length === 0) return;
    for (const request of newlyArrived) {
      toastedIdsRef.current.add(request.messageUri);
    }
    setPendingToasts((current) => [...current, ...newlyArrived]);
  }, [requests]);

  const removePending = useCallback((messageUri: string) => {
    setPendingToasts((current) =>
      current.filter((request) => request.messageUri !== messageUri),
    );
  }, []);

  const unseenCount = useMemo(
    () => requests.filter((request) => !seenIds.has(request.messageUri)).length,
    [requests, seenIds],
  );

  const markAllSeen = useCallback(() => {
    markSeen(requests.map((request) => request.messageUri));
  }, [requests, markSeen]);

  const selectRequest = useCallback((messageUri: string | null) => {
    setSelectedRequestId(messageUri);
    setNavigationCount((current) => current + 1);
    void loadRequests();
  }, [loadRequests]);

  const value = useMemo<RequestNotificationsContextValue>(
    () => ({
      requests,
      loading,
      error,
      busyMessageUri,
      loadRequests,
      approve,
      deny,
      unseenCount,
      isSeen,
      markSeen,
      markAllSeen,
      selectedRequestId,
      selectRequest,
      navigationCount,
    }),
    [
      requests,
      loading,
      error,
      busyMessageUri,
      loadRequests,
      approve,
      deny,
      unseenCount,
      isSeen,
      markSeen,
      markAllSeen,
      selectedRequestId,
      selectRequest,
      navigationCount,
    ],
  );

  return (
    <RequestNotificationsContext.Provider value={value}>
      {children}
      {pendingToasts.map((request) => (
        <RequestToastFirer
          key={request.messageUri}
          request={request}
          onFired={removePending}
        />
      ))}
    </RequestNotificationsContext.Provider>
  );
};

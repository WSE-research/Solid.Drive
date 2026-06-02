/**
 * Orchestrator for the Requests view body.
 *
 * Consumes inbox state from {@link RequestNotificationsContext} — the
 * single source of truth fed by the Solid Notifications WebSocket
 * subscription — and routes it to four UI branches:
 *   - loading  → centered spinner
 *   - error    → inline error block
 *   - empty    → muted "no requests" hint
 *   - data     → one {@link RequestCard} per pending request
 *
 * Marks the visible request set as "seen" on mount so the bell badge
 * clears, and scrolls the selected request into view when the user
 * deep-links from the bell dropdown.
 *
 * @packageDocumentation
 */

import { useEffect, useMemo, useRef } from 'react';
import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { useRequestNotifications } from '@/features/profile/contexts/RequestNotificationsContext';
import { RequestCard } from './RequestCard';

/**
 * Renders the Requests view body.
 *
 * @public
 */
export const RequestsList: FunctionComponent = () => {
  const [translate] = useTranslation();
  const notifications = useRequestNotifications();
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  const requests = useMemo(() => notifications?.requests ?? [], [notifications?.requests]);
  const loading = notifications?.loading ?? false;
  const error = notifications?.error ?? null;
  const busyMessageUri = notifications?.busyMessageUri ?? null;
  const selectedRequestId = notifications?.selectedRequestId ?? null;

  useEffect(() => {
    if (!notifications) return;
    if (requests.length === 0) return;
    notifications.markSeen(requests.map((request) => request.messageUri));
  }, [requests, notifications]);

  useEffect(() => {
    if (!selectedRequestId) return;
    const node = cardRefs.current.get(selectedRequestId);
    if (!node) return;
    node.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [selectedRequestId, requests]);

  const registerCard = (messageUri: string) => (node: HTMLElement | null) => {
    if (node) {
      cardRefs.current.set(messageUri, node);
    } else {
      cardRefs.current.delete(messageUri);
    }
  };

  const handleRefresh = (): void => {
    notifications?.selectRequest(null);
    void notifications?.loadRequests();
  };

  return (
    <requests-list>
      <requests-list-header>
        <button
          type="button"
          className="odl-requests-list__refresh"
          onClick={handleRefresh}
          disabled={loading}
        >
          {translate('oneDriveLayout.requestsView.refresh', 'Refresh')}
        </button>
      </requests-list-header>

      {loading && (
        <requests-list-state data-state="loading">
          <div className="spinner spinner--small" aria-hidden />
          <span>{translate('oneDriveLayout.requestsView.loading', 'Loading requests…')}</span>
        </requests-list-state>
      )}

      {!loading && error && (
        <requests-list-state data-state="error">
          <p className="odl-requests-list__error">{error}</p>
        </requests-list-state>
      )}

      {!loading && !error && requests.length === 0 && (
        <requests-list-state data-state="empty">
          <h3 className="odl-requests-list__empty-title">
            {translate(
              'oneDriveLayout.requestsView.emptyTitle',
              'No pending requests',
            )}
          </h3>
          <p className="odl-requests-list__empty-subtitle">
            {translate(
              'oneDriveLayout.requestsView.emptySubtitle',
              'When someone asks for access to your files, you will see it here.',
            )}
          </p>
        </requests-list-state>
      )}

      {!loading && !error && requests.length > 0 && notifications && (
        <requests-list-body>
          {requests.map((request) => {
            const isSelected = request.messageUri === selectedRequestId;
            return (
              <RequestCard
                key={request.messageUri}
                request={request}
                busy={busyMessageUri === request.messageUri}
                highlighted={isSelected}
                onApprove={notifications.approve}
                onDeny={notifications.deny}
                cardRef={registerCard(request.messageUri)}
              />
            );
          })}
        </requests-list-body>
      )}
    </requests-list>
  );
};

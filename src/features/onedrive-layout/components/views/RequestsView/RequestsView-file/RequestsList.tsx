/**
 * Orchestrator for the Requests view body.
 *
 * Owns the {@link useAccessRequests} subscription and routes its state
 * to four UI branches:
 *   - loading  → centered spinner
 *   - error    → inline error block + Refresh
 *   - empty    → muted "no requests" hint
 *   - data     → one {@link RequestCard} per pending request
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccessRequests } from '@/features/profile/hooks/useAccessRequests';
import { RequestCard } from './RequestCard';

/**
 * Props for {@link RequestsList}.
 *
 * @public
 */
export interface RequestsListProps {
  ownerWebId: string;
  storageRoot: string;
  catalogUri: string;
}

/**
 * Renders the Requests view body.
 *
 * @public
 */
export const RequestsList: FunctionComponent<RequestsListProps> = ({
  ownerWebId,
  storageRoot,
  catalogUri,
}) => {
  const [translate] = useTranslation();
  const {
    requests,
    loading,
    error,
    busyMessageUri,
    loadRequests,
    approve,
    deny,
  } = useAccessRequests(ownerWebId, storageRoot, catalogUri);

  return (
    <requests-list>
      <requests-list-header>
        <h2 className="odl-requests-list__heading">
          {translate('oneDriveLayout.requestsView.heading', 'Pending requests')}
        </h2>
        <button
          type="button"
          className="odl-requests-list__refresh"
          onClick={loadRequests}
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

      {!loading && !error && requests.length > 0 && (
        <requests-list-body>
          {requests.map((request) => (
            <RequestCard
              key={request.messageUri}
              request={request}
              busy={busyMessageUri === request.messageUri}
              onApprove={approve}
              onDeny={deny}
            />
          ))}
        </requests-list-body>
      )}
    </requests-list>
  );
};

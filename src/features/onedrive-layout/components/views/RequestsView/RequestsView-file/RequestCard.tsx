/**
 * Single OneDrive-style card for one pending access request.
 *
 * The card lays out as: avatar | requester name + description + timestamp |
 * Approve / Deny actions. The Approve button is filled (primary blue) and
 * Deny is an outline destructive pill, matching the rest of the layout's
 * action language.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useResource, useSubject } from '@ldo/solid-react';
import { useTranslation } from 'react-i18next';
import { SolidProfileShapeType } from '@/.ldo/solidProfile.shapeTypes';
import { isLoadable } from '@/infrastructure/solid/resourceGuards';
import { Avatar } from '@/shared/components/Avatar';
import { getInitial, getProfileDisplayName } from '@/shared/utils';
import { getFileTypeInfo } from '@/infrastructure/validation/fileTypeRegistry';
import {
  DEFAULT_LOCALE,
  SHORT_DATE_FORMAT_OPTIONS,
  MAX_DISPLAY_NAME_LENGTH,
} from '@/config';
import type { AccessRequest } from '@/infrastructure/inbox/inboxAccess';

/**
 * Props for {@link RequestCard}.
 *
 * @public
 */
export interface RequestCardProps {
  request: AccessRequest;
  busy: boolean;
  onApprove: (request: AccessRequest) => void | Promise<void>;
  onDeny: (request: AccessRequest) => void | Promise<void>;
}

const truncateName = (name: string): string =>
  name.length <= MAX_DISPLAY_NAME_LENGTH
    ? name
    : `${name.slice(0, MAX_DISPLAY_NAME_LENGTH)}…`;

/**
 * Renders one access-request card.
 *
 * @public
 */
export const RequestCard: FunctionComponent<RequestCardProps> = ({
  request,
  busy,
  onApprove,
  onDeny,
}) => {
  const [translate] = useTranslation();
  const profileDocUri = request.requesterWebId.split('#')[0];
  const profileResource = useResource(profileDocUri);
  const profile = useSubject(SolidProfileShapeType, request.requesterWebId);

  const profileLoading = isLoadable(profileResource) && profileResource.isLoading();
  const displayName = getProfileDisplayName(profile, request.requesterWebId);
  const truncatedName = truncateName(displayName);
  const avatarUrl = profile?.img?.['@id'];
  const initial = getInitial(displayName);

  const formattedDate = request.timestamp
    ? new Date(request.timestamp).toLocaleDateString(
        DEFAULT_LOCALE,
        SHORT_DATE_FORMAT_OPTIONS,
      )
    : '';

  // Mirrors the description-key fallback used by the classic
  // RequestsPanel — the same i18n strings drive both views.
  const resourceLabel =
    request.requestType === 'file'
      ? /* v8 ignore next */
        decodeURIComponent(
          request.accessTo.replace(/\/$/, '').split('/').pop() ?? request.accessTo,
        )
      : undefined;

  const typeLabel =
    request.requestType === 'type' && request.forClass
      ? getFileTypeInfo(request.forClass).label
      : undefined;

  const descriptionKey =
    request.requestType === 'file'
      ? 'requestsPanel.requestsFileAccess'
      : request.requestType === 'type'
      ? 'requestsPanel.requestsTypeAccess'
      : 'requestsPanel.requestsAccess';

  return (
    <request-card data-testid="request-card" data-busy={busy ? 'true' : undefined}>
      <Avatar
        src={avatarUrl}
        alt={displayName}
        initial={initial}
        size="md"
        isLoading={profileLoading}
      />
      <request-card-body>
        <h3 className="odl-request-card__name">{truncatedName}</h3>
        <p className="odl-request-card__description">
          {translate(descriptionKey, { resource: resourceLabel, type: typeLabel })}
        </p>
        {formattedDate && (
          <time className="odl-request-card__time" dateTime={request.timestamp}>
            {formattedDate}
          </time>
        )}
      </request-card-body>
      <request-card-actions>
        <button
          type="button"
          className="odl-request-card__action odl-request-card__action--approve"
          onClick={() => onApprove(request)}
          disabled={busy}
        >
          {translate('requestsPanel.approve', 'Approve')}
        </button>
        <button
          type="button"
          className="odl-request-card__action odl-request-card__action--deny"
          onClick={() => onDeny(request)}
          disabled={busy}
        >
          {translate('requestsPanel.deny', 'Deny')}
        </button>
      </request-card-actions>
    </request-card>
  );
};

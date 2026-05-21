/**
 * Single OneDrive-style card for one pending access request.
 *
 * Avatar | requester name + description + timestamp | Approve / Deny.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/shared/components/Avatar";
import { getInitial, truncateDisplayName } from "@/shared/utils";
import { useRequesterProfile } from "@/features/profile/hooks/useRequesterProfile";
import { buildRequestDescription } from "@/features/profile/utils/buildRequestDescription";
import { DEFAULT_LOCALE, SHORT_DATE_FORMAT_OPTIONS } from "@/config";
import type { AccessRequest } from "@/infrastructure/inbox/inboxAccess";

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
  highlighted?: boolean;
  cardRef?: (node: HTMLElement | null) => void;
}

const formatTimestamp = (timestamp: string): string =>
  timestamp
    ? new Date(timestamp).toLocaleDateString(DEFAULT_LOCALE, SHORT_DATE_FORMAT_OPTIONS)
    : "";

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
  highlighted,
  cardRef,
}) => {
  const [translate] = useTranslation();
  const { profileLoading, displayName, avatarUrl } = useRequesterProfile(
    request.requesterWebId,
  );

  const truncatedName = truncateDisplayName(displayName);
  const initial = getInitial(displayName);
  const description = buildRequestDescription(request, translate);
  const formattedDate = formatTimestamp(request.timestamp);

  const handleApprove = () => onApprove(request);
  const handleDeny = () => onDeny(request);

  return (
    <request-card
      ref={cardRef}
      data-testid="request-card"
      data-busy={busy ? "true" : undefined}
      data-highlighted={highlighted ? "true" : undefined}
    >
      <Avatar
        src={avatarUrl}
        alt={displayName}
        initial={initial}
        size="md"
        isLoading={profileLoading}
      />
      <request-card-body>
        <h3 className="odl-request-card__name">{truncatedName}</h3>
        <p className="odl-request-card__description">{description}</p>
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
          onClick={handleApprove}
          disabled={busy}
        >
          {translate("requestsPanel.approve", "Approve")}
        </button>
        <button
          type="button"
          className="odl-request-card__action odl-request-card__action--deny"
          onClick={handleDeny}
          disabled={busy}
        >
          {translate("requestsPanel.deny", "Deny")}
        </button>
      </request-card-actions>
    </request-card>
  );
};

/**
 * Contact row for managing Pod contacts. The catalog request control
 * reads as its own outcome — Pending… while awaiting, then Approved or
 * Denied once the owner decides, each with a re-request action that loops
 * back to Pending.
 *
 * @packageDocumentation
 */

import type { FunctionComponent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { AccessApproval, AccessRejection } from "@/infrastructure/inbox/inboxAccess";
import { MAX_DISPLAY_NAME_LENGTH } from "@/config";
import { Avatar } from "@/shared/components/Avatar";
import { RequestStatusPill } from "@/shared/components/RequestStatusPill";
import { useContactProfile } from "@/shared/hooks/useContactProfile";
import { useRequestStatus } from "@/shared/hooks/usePendingRequests";
import { useContactRequest } from "@/features/profile/hooks/useContactRequest";

/**
 * Truncates a display name to {@link MAX_DISPLAY_NAME_LENGTH}, appending an
 * ellipsis when shortened so contact rows render at a consistent width.
 *
 * @internal
 */
function truncateName(name: string): string {
  if (name.length <= MAX_DISPLAY_NAME_LENGTH) return name;
  return `${name.slice(0, MAX_DISPLAY_NAME_LENGTH)}...`;
}

/**
 * Props for the ContactRow component.
 */
type ContactRowProps = {
  webId: string;
  ownerWebId: string;
  solidFetch: (url: RequestInfo, init?: RequestInit) => Promise<Response>;
  approval: AccessApproval | undefined;
  rejection: AccessRejection | undefined;
  onClearOutcome: () => void;
  onRemove: () => void;
};

/**
 * Row displaying a single contact with its catalog request control and a
 * remove button.
 *
 * @public
 */
export const ContactRow: FunctionComponent<ContactRowProps> = ({
  webId,
  ownerWebId,
  solidFetch,
  approval,
  rejection,
  onClearOutcome,
  onRemove,
}) => {
  const [translate] = useTranslation();
  const { displayName, avatarUrl, initial, isLoading } = useContactProfile(webId);
  const { failed, request, requestAgain } = useContactRequest({
    webId,
    ownerWebId,
    solidFetch,
    outcomeMessageUri: approval?.messageUri ?? rejection?.messageUri,
    onClearOutcome,
  });
  const status = useRequestStatus(webId, { approved: !!approval, denied: !!rejection });

  const nameDisplay = isLoading ? translate("profileSidebar.loading") : truncateName(displayName);

  const settledPill = (labelKey: string): ReactNode => (
    <RequestStatusPill
      status={status === "approved" ? "approved" : "denied"}
      label={translate(labelKey)}
      requestAgainLabel={translate("profileSidebar.requestAgain")}
      onRequestAgain={requestAgain}
    />
  );

  const requestControl = ((): ReactNode => {
    if (status === "approved") return settledPill("profileSidebar.requestApproved");
    if (status === "denied") return settledPill("profileSidebar.requestDenied");
    if (status === "pending") {
      return <RequestStatusPill status="pending" label={translate("profileSidebar.requestPending")} />;
    }
    return (
      <button className="btn btn--ghost btn--small" onClick={request}>
        {translate(failed ? "profileSidebar.requestError" : "profileSidebar.requestAccess")}
      </button>
    );
  })();

  return (
    <contact-row>
      <Avatar src={avatarUrl} alt={displayName} initial={initial} size="sm" isLoading={isLoading} />
      <span className="contact-row__name">{nameDisplay}</span>
      <contact-row-actions>
        {requestControl}
        <button className="btn btn--delete btn--small" onClick={onRemove}>
          {translate("profileSidebar.remove")}
        </button>
      </contact-row-actions>
    </contact-row>
  );
};

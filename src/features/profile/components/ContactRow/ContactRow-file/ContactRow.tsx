/**
 * Contact row component for managing Pod contacts.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from "react";
import { useTranslation } from "react-i18next";
import type { AccessRejection } from "@/infrastructure/inbox/inboxAccess";
import { MAX_DISPLAY_NAME_LENGTH } from "@/config";
import { Avatar } from "@/shared/components/Avatar";
import { useContactProfile } from "@/shared/hooks/useContactProfile";
import { useContactRequest, type RequestStatus } from "@/features/profile/hooks/useContactRequest";

/**
 * Maps a *settled* request status (`sent`, `error`, `idle`) to the i18n
 * key used for the action button label. The `sending` state is rendered
 * as a literal ellipsis by the component, so it intentionally has no key.
 *
 * @internal
 */
function settledRequestLabelKey(status: Exclude<RequestStatus, "sending">): string {
  switch (status) {
    case "sent":
      return "profileSidebar.requestSent";
    case "error":
      return "profileSidebar.requestError";
    case "idle":
      return "profileSidebar.requestAccess";
  }
}

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
  rejection: AccessRejection | undefined;
  onClearRejection: () => void;
  onRemove: () => void;
};

/**
 * Row displaying a single contact with request access and remove buttons.
 *
 * @public
 */
export const ContactRow: FunctionComponent<ContactRowProps> = ({
  webId,
  ownerWebId,
  solidFetch,
  rejection,
  onClearRejection,
  onRemove,
}) => {
  const [translate] = useTranslation();
  const { displayName, avatarUrl, initial, isLoading } = useContactProfile(webId);
  const { status, requestAccess, requestAgain } = useContactRequest({
    webId,
    ownerWebId,
    solidFetch,
    rejection,
    onClearRejection,
  });

  const nameDisplay = isLoading ? translate("profileSidebar.loading") : truncateName(displayName);
  const isRequestDisabled = status === "sending" || status === "sent";
  const requestButtonLabel =
    status === "sending" ? "..." : translate(settledRequestLabelKey(status));

  return (
    <contact-row>
      <Avatar src={avatarUrl} alt={displayName} initial={initial} size="sm" isLoading={isLoading} />
      <span className="contact-row__name">{nameDisplay}</span>
      <contact-row-actions>
        {rejection ? (
          <>
            <span className="contact-row__denied">{translate("profileSidebar.requestDenied")}</span>
            <button className="btn btn--ghost btn--small" onClick={requestAgain}>
              {translate("profileSidebar.requestAgain")}
            </button>
          </>
        ) : (
          <button
            className="btn btn--ghost btn--small"
            onClick={requestAccess}
            disabled={isRequestDisabled}
          >
            {requestButtonLabel}
          </button>
        )}
        <button className="btn btn--delete btn--small" onClick={onRemove}>
          {translate("profileSidebar.remove")}
        </button>
      </contact-row-actions>
    </contact-row>
  );
};

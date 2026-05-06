/**
 * Contact row component for managing Pod contacts.
 *
 * @packageDocumentation
 */

import { useState, useCallback } from "react";
import type { FunctionComponent } from "react";
import { useTranslation } from "react-i18next";
import {discoverInboxUri, postCatalogAccessRequest, deleteAccessRequest, type AccessRejection } from "@/infrastructure/inbox/inboxAccess";
import { MAX_DISPLAY_NAME_LENGTH } from "@/config";
import { Avatar } from "@/shared/components/Avatar";
import { useContactProfile } from "@/shared/hooks/useContactProfile";

type RequestStatus = "idle" | "sending" | "sent" | "error";

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
 * Handles access request status and rejection notifications.
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
  const [requestStatus, setRequestStatus] = useState<RequestStatus>("idle");

  const handleRequestAccess = useCallback(async () => {
    setRequestStatus("sending");
    try {
      const inboxUri = await discoverInboxUri(webId, solidFetch);
      await postCatalogAccessRequest(inboxUri, ownerWebId, webId, solidFetch);
      setRequestStatus("sent");
    } catch {
      setRequestStatus("error");
    }
  }, [webId, ownerWebId, solidFetch]);

  const handleRequestAgain = useCallback(async () => {
    /* v8 ignore next 2 */
    if (!rejection) return;
    try {
      await deleteAccessRequest(rejection.messageUri, solidFetch);
    } catch {
      // Cleanup failure is non-critical
    }
    onClearRejection();
    setRequestStatus("idle");
    void handleRequestAccess();
  }, [rejection, solidFetch, onClearRejection, handleRequestAccess]);

  const nameDisplay = isLoading ? translate("profileSidebar.loading") : truncateName(displayName);
  const isRequestDisabled = requestStatus === "sending" || requestStatus === "sent";
  const requestButtonLabel =
    requestStatus === "sending" ? "..." : translate(settledRequestLabelKey(requestStatus));

  return (
    <contact-row>
      <Avatar src={avatarUrl} alt={displayName} initial={initial} size="sm" isLoading={isLoading} />
      <span className="contact-row__name">{nameDisplay}</span>
      <contact-row-actions>
        {rejection ? (
          <>
            <span className="contact-row__denied">{translate("profileSidebar.requestDenied")}</span>
            <button className="btn btn--ghost btn--small" onClick={handleRequestAgain}>
              {translate("profileSidebar.requestAgain")}
            </button>
          </>
        ) : (
          <button
            className="btn btn--ghost btn--small"
            onClick={handleRequestAccess}
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

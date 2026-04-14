/**
 * Contact row component for managing Pod contacts.
 *
 * @packageDocumentation
 */

import { useState, useCallback } from "react";
import type { FunctionComponent } from "react";
import { useResource, useSubject } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { SolidProfileShapeType } from "@/.ldo/solidProfile.shapeTypes";
import { isLoadable } from "@/infrastructure/solid/resourceGuards";
import { discoverInboxUri, postCatalogAccessRequest } from "@/infrastructure/inbox/inboxAccess";
import { deleteAccessRequest } from "@/infrastructure/inbox/inboxAccess";
import type { AccessRejection } from "@/infrastructure/inbox/inboxAccess";
import { MAX_DISPLAY_NAME_LENGTH } from "@/config";
import { Avatar } from "@/shared/components/Avatar";
import { getInitial, getProfileDisplayName } from "@/shared/utils";

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
  const contactResource = useResource(webId.split("#")[0]);
  const contact = useSubject(SolidProfileShapeType, webId);
  const isLoading = isLoadable(contactResource) && contactResource.isLoading();
  const [requestStatus, setRequestStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const displayName = getProfileDisplayName(contact, webId);
  const avatarUrl = contact?.img?.["@id"];
  const initial = getInitial(displayName);

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

  const truncatedName = displayName.length > MAX_DISPLAY_NAME_LENGTH
    ? `${displayName.slice(0, MAX_DISPLAY_NAME_LENGTH)}...`
    : displayName;
  const nameDisplay = isLoading ? translate("profileSidebar.loading") : truncatedName;
  const isRequestDisabled = requestStatus === "sending" || requestStatus === "sent";
  const requestButtonLabel = requestStatus === "sending"
    ? "..."
    : requestStatus === "sent"
    ? translate("profileSidebar.requestSent")
    : requestStatus === "error"
    ? translate("profileSidebar.requestError")
    : translate("profileSidebar.requestAccess");

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

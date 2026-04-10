/**
 * Access requests panel for managing incoming sharing requests.
 *
 * @packageDocumentation
 */

import { useState, type FunctionComponent } from "react";
import { useSubject, useResource } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { SolidProfileShapeType } from "@/.ldo/solidProfile.shapeTypes";
import { isLoadable } from "@/infrastructure/solid/resourceGuards";
import type { AccessRequest } from "@/infrastructure/inbox/inboxAccess";
import { useAccessRequests } from "@/features/profile/hooks/useAccessRequests";
import { MAX_DISPLAY_NAME_LENGTH, DEFAULT_LOCALE, SHORT_DATE_FORMAT_OPTIONS } from "@/config";
import { Avatar } from "@/shared/components/Avatar";
import { getInitial, getProfileDisplayName } from "@/shared/utils";

/**
 * Row component displaying the requester's profile info.
 *
 * @internal
 */
const RequesterRow: FunctionComponent<{ webId: string }> = ({ webId }) => {
  const [translate] = useTranslation();
  const requesterResource = useResource(webId.split("#")[0]);
  const requester = useSubject(SolidProfileShapeType, webId);
  const isLoading = isLoadable(requesterResource) && requesterResource.isLoading();
  const displayName = getProfileDisplayName(requester, webId);
  const avatarUrl = requester?.img?.["@id"];
  const initial = getInitial(displayName);
  const truncatedName = displayName.length > MAX_DISPLAY_NAME_LENGTH
    ? `${displayName.slice(0, MAX_DISPLAY_NAME_LENGTH)}…`
    : displayName;

  return (
    <requests-panel-requester>
      <Avatar src={avatarUrl} alt={displayName} initial={initial} size="sm" isLoading={isLoading} />
      <span className="requests-panel__requester-name">
        {isLoading ? translate("requestsPanel.loading") : truncatedName}
      </span>
    </requests-panel-requester>
  );
};

/**
 * Request item component with approve/deny actions.
 *
 * @internal
 */
const RequestItem: FunctionComponent<{
  request: AccessRequest;
  onApprove: (r: AccessRequest) => Promise<void>;
  onDeny: (r: AccessRequest) => Promise<void>;
  isBusy: boolean;
}> = ({ request, onApprove, onDeny, isBusy }) => {
  const [translate] = useTranslation();

  const formattedDate = request.timestamp
    ? new Date(request.timestamp).toLocaleDateString(DEFAULT_LOCALE, SHORT_DATE_FORMAT_OPTIONS)
    : "";

  const descriptionKey = request.requestType === "file"
    ? "requestsPanel.requestsFileAccess"
    : "requestsPanel.requestsAccess";

  const resourceLabel = request.requestType === "file"
    ? decodeURIComponent(request.accessTo.replace(/\/$/, "").split("/").pop() ?? request.accessTo)
    : undefined;

  const handleApprove = () => onApprove(request);
  const handleDeny = () => onDeny(request);

  return (
    <requests-panel-item>
      <RequesterRow webId={request.requesterWebId} />
      <p className="requests-panel__description">
        {translate(descriptionKey, { resource: resourceLabel })}
      </p>
      {formattedDate && <p className="requests-panel__timestamp">{formattedDate}</p>}
      <requests-panel-actions>
        <button className="btn btn--primary btn--small" onClick={handleApprove} disabled={isBusy}>
          {translate("requestsPanel.approve")}
        </button>
        <button className="btn btn--delete btn--small" onClick={handleDeny} disabled={isBusy}>
          {translate("requestsPanel.deny")}
        </button>
      </requests-panel-actions>
    </requests-panel-item>
  );
};

/**
 * Props for the RequestsPanel component.
 */
export type RequestsPanelProps = {
  ownerWebId: string;
  storageRoot: string;
  catalogUri: string;
};

/**
 * Collapsible panel showing pending access requests from contacts.
 * Loads requests from the user's inbox when opened.
 *
 * @public
 */
export const RequestsPanel: FunctionComponent<RequestsPanelProps> = ({
  ownerWebId,
  storageRoot,
  catalogUri,
}) => {
  const [translate] = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const { requests, loading, error, busyMessageUri, loadRequests, approve, deny } =
    useAccessRequests(ownerWebId, storageRoot, catalogUri);

  function handleToggle() {
    if (!isOpen) loadRequests();
    setIsOpen((prev) => !prev);
  }

  const chevronStyle = { transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" };

  return (
    <requests-panel>
      <button className="requests-panel__toggle" onClick={handleToggle}>
        <span>{translate("requestsPanel.heading")}</span>
        {requests.length > 0 && <span className="requests-panel__badge">{requests.length}</span>}
        <span className="requests-panel__chevron" style={chevronStyle}>▼</span>
      </button>

      {isOpen && (
        <requests-panel-body>
          {loading && (
            <requests-panel-loading>
              <div className="spinner spinner--small" />
              {translate("requestsPanel.loading")}
            </requests-panel-loading>
          )}
          {error && <p className="requests-panel__error">{error}</p>}
          {!loading && !error && requests.length === 0 && (
            <p className="requests-panel__empty">{translate("requestsPanel.noRequests")}</p>
          )}
          {!loading && requests.map((request) => (
            <RequestItem
              key={request.messageUri}
              request={request}
              onApprove={approve}
              onDeny={deny}
              isBusy={busyMessageUri === request.messageUri}
            />
          ))}
          {!loading && (
            <button className="btn btn--ghost btn--small requests-panel__refresh" onClick={loadRequests} disabled={loading}>
              {translate("requestsPanel.refresh")}
            </button>
          )}
        </requests-panel-body>
      )}
    </requests-panel>
  );
};

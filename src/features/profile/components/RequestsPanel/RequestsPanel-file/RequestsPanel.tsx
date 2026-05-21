/**
 * Access requests panel for managing incoming sharing requests.
 *
 * @packageDocumentation
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FunctionComponent,
} from "react";
import { useTranslation } from "react-i18next";
import type { AccessRequest } from "@/infrastructure/inbox/inboxAccess";
import { useRequestNotifications } from "@/features/profile/contexts/RequestNotificationsContext";
import { useRequesterProfile } from "@/features/profile/hooks/useRequesterProfile";
import { buildRequestDescription } from "@/features/profile/utils/buildRequestDescription";
import { DEFAULT_LOCALE, SHORT_DATE_FORMAT_OPTIONS } from "@/config";
import { Avatar } from "@/shared/components/Avatar";
import { getInitial, truncateDisplayName } from "@/shared/utils";

const CHEVRON_STYLE_OPEN: CSSProperties = {
  transform: "rotate(180deg)",
  transition: "transform 0.15s",
};
const CHEVRON_STYLE_CLOSED: CSSProperties = {
  transform: "rotate(0deg)",
  transition: "transform 0.15s",
};

const formatTimestamp = (timestamp: string): string =>
  timestamp
    ? new Date(timestamp).toLocaleDateString(DEFAULT_LOCALE, SHORT_DATE_FORMAT_OPTIONS)
    : "";

const RequesterRow: FunctionComponent<{ webId: string }> = ({ webId }) => {
  const [translate] = useTranslation();
  const { profileLoading, displayName, avatarUrl } = useRequesterProfile(webId);
  const initial = getInitial(displayName);
  const nameDisplay = profileLoading
    ? translate("requestsPanel.loading")
    : truncateDisplayName(displayName);

  return (
    <requests-panel-requester>
      <Avatar
        src={avatarUrl}
        alt={displayName}
        initial={initial}
        size="sm"
        isLoading={profileLoading}
      />
      <span className="requests-panel__requester-name">{nameDisplay}</span>
    </requests-panel-requester>
  );
};

interface RequestItemProps {
  request: AccessRequest;
  onApprove: (request: AccessRequest) => Promise<void>;
  onDeny: (request: AccessRequest) => Promise<void>;
  isBusy: boolean;
  highlighted?: boolean;
  itemRef?: (node: HTMLElement | null) => void;
}

const RequestItem: FunctionComponent<RequestItemProps> = ({
  request,
  onApprove,
  onDeny,
  isBusy,
  highlighted,
  itemRef,
}) => {
  const [translate] = useTranslation();
  const formattedDate = formatTimestamp(request.timestamp);
  const description = buildRequestDescription(request, translate);

  const handleApprove = () => onApprove(request);
  const handleDeny = () => onDeny(request);

  return (
    <requests-panel-item
      ref={itemRef}
      data-highlighted={highlighted ? "true" : undefined}
    >
      <RequesterRow webId={request.requesterWebId} />
      <p className="requests-panel__description">{description}</p>
      {formattedDate && <p className="requests-panel__timestamp">{formattedDate}</p>}
      <requests-panel-actions>
        <button
          className="btn btn--primary btn--small"
          onClick={handleApprove}
          disabled={isBusy}
        >
          {translate("requestsPanel.approve")}
        </button>
        <button
          className="btn btn--delete btn--small"
          onClick={handleDeny}
          disabled={isBusy}
        >
          {translate("requestsPanel.deny")}
        </button>
      </requests-panel-actions>
    </requests-panel-item>
  );
};

const noopRequestAction = async (): Promise<void> => {};

/**
 * Collapsible panel showing pending access requests from contacts. Reads
 * inbox state from {@link RequestNotificationsContext} so the panel
 * stays live without its own fetch hook.
 *
 * @public
 */
export const RequestsPanel: FunctionComponent = () => {
  const [translate] = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const notifications = useRequestNotifications();
  const requests = useMemo(
    () => notifications?.requests ?? [],
    [notifications?.requests],
  );
  const loading = notifications?.loading ?? false;
  const error = notifications?.error ?? null;
  const busyMessageUri = notifications?.busyMessageUri ?? null;
  const loadRequests = notifications?.loadRequests;
  const approve = notifications?.approve ?? noopRequestAction;
  const deny = notifications?.deny ?? noopRequestAction;
  const selectedRequestId = notifications?.selectedRequestId ?? null;
  const navigationCount = notifications?.navigationCount ?? 0;

  const panelRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [previousNavCount, setPreviousNavCount] = useState(navigationCount);

  if (notifications && previousNavCount !== navigationCount) {
    setPreviousNavCount(navigationCount);
    setIsOpen(true);
  }

  useEffect(() => {
    if (!notifications) return;
    if (previousNavCount === 0) return;
    panelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [previousNavCount, notifications]);

  useEffect(() => {
    if (!notifications) return;
    if (!isOpen) return;
    if (requests.length === 0) return;
    notifications.markSeen(requests.map((request) => request.messageUri));
  }, [isOpen, requests, notifications]);

  useEffect(() => {
    if (!selectedRequestId) return;
    const node = itemRefs.current.get(selectedRequestId);
    node?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [selectedRequestId, requests]);

  const registerItem = (messageUri: string) => (node: HTMLElement | null) => {
    if (node) itemRefs.current.set(messageUri, node);
    else itemRefs.current.delete(messageUri);
  };

  const handleToggle = (): void => {
    if (!isOpen) void loadRequests?.();
    setIsOpen((prev) => !prev);
  };

  const handleRefresh = (): void => {
    void loadRequests?.();
  };

  const hasPendingRequests = requests.length > 0;
  const isEmpty = !loading && !error && !hasPendingRequests;
  const chevronStyle = isOpen ? CHEVRON_STYLE_OPEN : CHEVRON_STYLE_CLOSED;

  return (
    <requests-panel ref={panelRef}>
      <button className="requests-panel__toggle" onClick={handleToggle}>
        <span>{translate("requestsPanel.heading")}</span>
        {hasPendingRequests && (
          <span className="requests-panel__badge">{requests.length}</span>
        )}
        <span className="requests-panel__chevron" style={chevronStyle}>
          ▼
        </span>
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
          {isEmpty && (
            <p className="requests-panel__empty">
              {translate("requestsPanel.noRequests")}
            </p>
          )}
          {!loading &&
            requests.map((request) => (
              <RequestItem
                key={request.messageUri}
                request={request}
                onApprove={approve}
                onDeny={deny}
                isBusy={busyMessageUri === request.messageUri}
                highlighted={request.messageUri === selectedRequestId}
                itemRef={registerItem(request.messageUri)}
              />
            ))}
          {!loading && (
            <button
              className="btn btn--ghost btn--small requests-panel__refresh"
              onClick={handleRefresh}
            >
              {translate("requestsPanel.refresh")}
            </button>
          )}
        </requests-panel-body>
      )}
    </requests-panel>
  );
};

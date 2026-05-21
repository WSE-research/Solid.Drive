/**
 * Single row inside the {@link NotificationBell} dropdown.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useTranslation } from "react-i18next";
import { useRequesterProfile } from "@/features/profile/hooks/useRequesterProfile";
import { buildRequestDescription } from "@/features/profile/utils/buildRequestDescription";
import { DEFAULT_LOCALE, SHORT_DATE_FORMAT_OPTIONS } from "@/config";
import type { AccessRequest } from "@/infrastructure/inbox/inboxAccess";

interface NotificationBellItemProps {
  request: AccessRequest;
  unseen: boolean;
  onSelect: (request: AccessRequest) => void;
}

const formatTimestamp = (timestamp: string): string => {
  if (!timestamp) return "";
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(DEFAULT_LOCALE, SHORT_DATE_FORMAT_OPTIONS);
};

/**
 * Renders one dropdown row with the resolved requester name.
 *
 * @public
 */
export const NotificationBellItem: FunctionComponent<NotificationBellItemProps> = ({
  request,
  unseen,
  onSelect,
}) => {
  const [translate] = useTranslation();
  const { profileLoading, displayName } = useRequesterProfile(request.requesterWebId);

  const senderName = profileLoading
    ? translate("notificationBell.loading", "Loading…")
    : displayName;
  const description = buildRequestDescription(request, translate);
  const timestamp = formatTimestamp(request.timestamp);

  const handleSelect = () => onSelect(request);

  return (
    <DropdownMenu.Item
      className="notification-bell__item"
      data-unseen={unseen ? "true" : undefined}
      onSelect={handleSelect}
    >
      <notification-bell-item-body className="notification-bell__item-body">
        <span className="notification-bell__sender">{senderName}</span>
        <span className="notification-bell__description">{description}</span>
        {timestamp && (
          <time className="notification-bell__time" dateTime={request.timestamp}>
            {timestamp}
          </time>
        )}
      </notification-bell-item-body>
    </DropdownMenu.Item>
  );
};

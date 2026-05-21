/**
 * Notification bell mounted in the OneDrive TopBar and the classic
 * Header.
 *
 * Shows a Radix dropdown listing the most recent unseen access
 * requests with the requester's display name, request description, and
 * timestamp. Selecting an item stores the message URI in
 * {@link RequestNotificationsContext} so each layout can react: the
 * OneDrive layout deep-links into the Requests view; the classic
 * layout's request panel highlights the row. The bell renders
 * silently when the provider is absent.
 *
 * @packageDocumentation
 */

import { useMemo } from 'react';
import type { FunctionComponent } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useTranslation } from 'react-i18next';
import { BellIcon, BellIconActive } from '@/features/onedrive-layout/icons';
import { useLayoutPreference } from '@/features/onedrive-layout/hooks/useLayoutPreference';
import { useRequestNotifications } from '@/features/profile/contexts/RequestNotificationsContext';
import { NOTIFICATION_BELL_MAX_BADGE_DISPLAY, NOTIFICATION_BELL_MAX_DROPDOWN_ITEMS } from '@/config';
import type { AccessRequest } from '@/infrastructure/inbox/inboxAccess';
import { NotificationBellItem } from './NotificationBellItem';
import './NotificationBell.css';

const toEpoch = (timestamp: string): number =>
  timestamp ? new Date(timestamp).getTime() : 0;

const sortByNewest = (requests: readonly AccessRequest[]): readonly AccessRequest[] =>
  [...requests].sort(
    (left, right) => toEpoch(right.timestamp) - toEpoch(left.timestamp),
  );

interface NotificationBellProps {
  /**
   * Optional callback fired when the user selects a request or the
   * "View all" link. Receives the message URI when an item is picked,
   * or `null` for "View all". Layouts use this to navigate or scroll
   * the corresponding request panel into view.
   *
   * @public
   */
  onNavigateToRequests?: (messageUri: string | null) => void;
}

/**
 * Renders the notification bell button and dropdown.
 *
 * @public
 */
export const NotificationBell: FunctionComponent<NotificationBellProps> = ({
  onNavigateToRequests,
}) => {
  const [translate] = useTranslation();
  const [layout] = useLayoutPreference();
  const ctx = useRequestNotifications();

  const requests = useMemo(() => ctx?.requests ?? [], [ctx?.requests]);
  const unseenCount = ctx?.unseenCount ?? 0;
  const hasUnseen = unseenCount > 0;

  const recent = useMemo(
    () => sortByNewest(requests).slice(0, NOTIFICATION_BELL_MAX_DROPDOWN_ITEMS),
    [requests],
  );
  const Glyph = hasUnseen ? BellIconActive : BellIcon;
  const ariaLabel = translate('notificationBell.label', {
    count: unseenCount,
    defaultValue: '{{count}} pending requests',
  });
  const badgeText =
    unseenCount > NOTIFICATION_BELL_MAX_BADGE_DISPLAY
      ? `${NOTIFICATION_BELL_MAX_BADGE_DISPLAY}+`
      : String(unseenCount);

  const handleSelect = (request: AccessRequest) => {
    ctx?.selectRequest(request.messageUri);
    onNavigateToRequests?.(request.messageUri);
  };

  const handleViewAll = () => {
    ctx?.selectRequest(null);
    onNavigateToRequests?.(null);
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="notification-bell"
          aria-label={ariaLabel}
          data-testid="notification-bell"
          data-layout={layout}
          data-has-unseen={hasUnseen ? 'true' : undefined}
        >
          <Glyph aria-hidden focusable={false} />
          {hasUnseen && (
            <span
              className="notification-bell__badge"
              data-testid="notification-bell-badge"
              aria-hidden
            >
              {badgeText}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="notification-bell__menu"
          data-layout={layout}
        >
          <DropdownMenu.Label className="notification-bell__heading">
            {translate('notificationBell.heading', 'Recent requests')}
          </DropdownMenu.Label>
          {recent.length === 0 ? (
            <notification-bell-empty className="notification-bell__empty">
              {translate('notificationBell.empty', 'No new requests')}
            </notification-bell-empty>
          ) : (
            <notification-bell-list className="notification-bell__list">
              {recent.map((request) => (
                <NotificationBellItem
                  key={request.messageUri}
                  request={request}
                  unseen={!ctx?.isSeen(request.messageUri)}
                  onSelect={handleSelect}
                />
              ))}
            </notification-bell-list>
          )}
          {onNavigateToRequests && (
            <>
              <DropdownMenu.Separator className="notification-bell__separator" />
              <DropdownMenu.Item
                className="notification-bell__view-all"
                onSelect={handleViewAll}
              >
                {translate('notificationBell.viewAll', 'View all requests')}
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

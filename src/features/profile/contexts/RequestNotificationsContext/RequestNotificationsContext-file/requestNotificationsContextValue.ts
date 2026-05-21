/**
 * Context object and hook for the request-notifications feature.
 * Split out from the provider component so React Fast Refresh treats
 * every edit to the provider as a hot replacement instead of a full
 * page reload.
 *
 * @packageDocumentation
 */

import { createContext, useContext } from 'react';
import type { AccessRequest } from '@/infrastructure/inbox/inboxAccess';

/**
 * Shape exposed by {@link RequestNotificationsContext}. Single source
 * of truth for inbox access requests across the bell badge, the
 * OneDrive Requests view, and the classic RequestsPanel — all read
 * the same live state fed by one Solid Notifications WebSocket
 * subscription.
 *
 * @public
 */
export interface RequestNotificationsContextValue {
  requests: readonly AccessRequest[];
  loading: boolean;
  error: string | null;
  busyMessageUri: string | null;
  loadRequests: () => Promise<void>;
  approve: (request: AccessRequest) => Promise<void>;
  deny: (request: AccessRequest) => Promise<void>;
  unseenCount: number;
  isSeen: (messageUri: string) => boolean;
  markSeen: (messageUris: readonly string[]) => void;
  markAllSeen: () => void;
  selectedRequestId: string | null;
  selectRequest: (messageUri: string | null) => void;
  /**
   * Monotonically-incrementing counter bumped on every `selectRequest`
   * call. Subscribers (such as the classic-layout RequestsPanel) use
   * it as an "open / scroll into view" signal so they can react even
   * when {@link selectedRequestId} resolves to the same value as
   * before (e.g. clicking "View all" twice).
   */
  navigationCount: number;
}

/**
 * Underlying React context. Consumers should call
 * {@link useRequestNotifications} rather than reading the context
 * directly.
 *
 * @internal
 */
export const RequestNotificationsContext = createContext<
  RequestNotificationsContextValue | undefined
>(undefined);

/**
 * Hook for reading the request-notifications context. Returns `null`
 * when called outside the provider so optional UI surfaces such as the
 * notification bell can render no-ops while logged out.
 *
 * @public
 */
export function useRequestNotifications(): RequestNotificationsContextValue | null {
  return useContext(RequestNotificationsContext) ?? null;
}

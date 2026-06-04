/**
 * Tracks outgoing access requests from the requester's side.
 *
 * {@link usePendingRequests} persists only the *pending* set — the
 * targets a request was sent for but not yet decided — in `localStorage`,
 * so "Pending…" survives reloads. Approval and denial are never stored;
 * they are live signals the caller passes to {@link useRequestStatus},
 * which also clears the pending flag the moment a request resolves so a
 * target can be denied once and approved later, each handled cleanly.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PENDING_REQUESTS_CHANGE_EVENT, PENDING_REQUESTS_STORAGE_KEY } from '@/config';

/**
 * Lifecycle of an outgoing access request, from the requester's side.
 *
 * @public
 */
export type RequestStatus = 'none' | 'pending' | 'approved' | 'denied';

const read = (): readonly string[] => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PENDING_REQUESTS_STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
};

const write = (ids: readonly string[]): void => {
  try {
    window.localStorage.setItem(PENDING_REQUESTS_STORAGE_KEY, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent(PENDING_REQUESTS_CHANGE_EVENT));
  } catch {
    // Storage unavailable (private mode, quota): in-memory state still updates.
  }
};

/**
 * Return value of {@link usePendingRequests}.
 *
 * @public
 */
export interface UsePendingRequestsReturn {
  isPending: (targetKey: string) => boolean;
  markPending: (targetKey: string) => void;
  clearPending: (targetKey: string) => void;
}

/**
 * Reads and updates the persisted set of pending request targets. All
 * hook instances stay in sync within the tab via a custom event, so the
 * control that sent a request and the control that shows its status never
 * diverge.
 *
 * @public
 */
export function usePendingRequests(): UsePendingRequestsReturn {
  const [ids, setIds] = useState<readonly string[]>(read);

  useEffect(() => {
    const sync = () => setIds(read());
    window.addEventListener(PENDING_REQUESTS_CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(PENDING_REQUESTS_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const markPending = useCallback((targetKey: string) => {
    const current = read();
    if (current.includes(targetKey)) return;
    const next = [...current, targetKey];
    write(next);
    setIds(next);
  }, []);

  const clearPending = useCallback((targetKey: string) => {
    const current = read();
    if (!current.includes(targetKey)) return;
    const next = current.filter((id) => id !== targetKey);
    write(next);
    setIds(next);
  }, []);

  const pending = useMemo(() => new Set(ids), [ids]);
  const isPending = useCallback((targetKey: string) => pending.has(targetKey), [pending]);

  return { isPending, markPending, clearPending };
}

/**
 * Resolves the live status of one request target from the requester's
 * side. Approval and denial are authoritative inbox notices the owner
 * posts for *this* request, so they are reported as-is; "pending" is the
 * persisted record that a request was sent but not yet decided.
 *
 * @public
 */
export function useRequestStatus(
  targetKey: string,
  signals: { approved: boolean; denied: boolean },
): RequestStatus {
  const { isPending } = usePendingRequests();

  if (signals.approved) return 'approved';
  if (signals.denied) return 'denied';
  if (isPending(targetKey)) return 'pending';
  return 'none';
}

/**
 * Hook for persisting which inbox request message URIs the user has
 * already seen. Used by {@link RequestNotificationsContext} to suppress
 * duplicate toast notifications and to compute the bell badge count.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SEEN_REQUESTS_CHANGE_EVENT,
  SEEN_REQUESTS_MAX_STORED,
  SEEN_REQUESTS_STORAGE_KEY,
} from '@/config';

const parseStoredIds = (raw: string | null): readonly string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
};

const readFromStorage = (): readonly string[] => {
  try {
    return parseStoredIds(window.localStorage.getItem(SEEN_REQUESTS_STORAGE_KEY));
  } catch {
    return [];
  }
};

const writeToStorage = (ids: readonly string[]): boolean => {
  try {
    const trimmed = ids.length > SEEN_REQUESTS_MAX_STORED ? ids.slice(-SEEN_REQUESTS_MAX_STORED) : ids;
    window.localStorage.setItem(SEEN_REQUESTS_STORAGE_KEY, JSON.stringify(trimmed));
    return true;
  } catch {
    return false;
  }
};

/**
 * Return value of {@link useSeenRequests}.
 *
 * @public
 */
export interface UseSeenRequestsReturn {
  seenIds: ReadonlySet<string>;
  isSeen: (id: string) => boolean;
  markSeen: (ids: readonly string[]) => void;
}

/**
 * Reads and updates the persisted set of "seen" inbox request message
 * URIs. Multiple hook instances stay in sync via a custom DOM event so
 * the bell badge and the requests view never diverge.
 *
 * @public
 */
export const useSeenRequests = (): UseSeenRequestsReturn => {
  const [ids, setIds] = useState<readonly string[]>(readFromStorage);

  useEffect(() => {
    const sync = () => setIds(readFromStorage());
    window.addEventListener(SEEN_REQUESTS_CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SEEN_REQUESTS_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const markSeen = useCallback((newlySeen: readonly string[]) => {
    if (newlySeen.length === 0) return;
    setIds((current) => {
      const merged = new Set(current);
      let changed = false;
      for (const id of newlySeen) {
        if (!merged.has(id)) {
          merged.add(id);
          changed = true;
        }
      }
      if (!changed) return current;
      const next = Array.from(merged);
      const persisted = writeToStorage(next);
      if (persisted) {
        window.dispatchEvent(new CustomEvent(SEEN_REQUESTS_CHANGE_EVENT));
      }
      return next;
    });
  }, []);

  const seenIds = useMemo(() => new Set(ids), [ids]);
  const isSeen = useCallback(
    (id: string) => seenIds.has(id),
    [seenIds],
  );

  return { seenIds, isSeen, markSeen };
};

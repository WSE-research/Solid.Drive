/**
 * Hook for reading and persisting the user's choice between the
 * classic explorer and the OneDrive-inspired layout.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useState } from 'react';

/**
 * Available layout choices for the application shell.
 */
export type Layout = 'classic' | 'onedrive';

const STORAGE_KEY = 'solid-drive.layout';
const CHANGE_EVENT = 'solid-drive:layout-changed';

/**
 * Type guard for the {@link Layout} union. Exported so call sites that
 * receive untyped values from URL params, DOM events, or Radix
 * callbacks can narrow them with a single source of truth.
 *
 * @public
 */
export const isLayout = (value: unknown): value is Layout =>
  value === 'classic' || value === 'onedrive';

const readFromStorage = (): Layout => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLayout(stored) ? stored : 'classic';
  } catch {
    // Some browsers reject storage access in private mode or when
    // third-party storage is blocked. Fall back to the default so the
    // UI still renders.
    return 'classic';
  }
};

/**
 * Reads and writes the active layout preference, persisting to
 * localStorage. Defaults to the classic layout so existing users see
 * no change on first load; corrupted or missing values fall back to
 * the same default.
 *
 * Multiple hook instances stay in sync: every setter dispatches a
 * custom event that all live instances listen for, so flipping the
 * preference in one component immediately updates the rest.
 *
 * @public
 */
export const useLayoutPreference = (): readonly [Layout, (next: Layout) => void] => {
  const [layout, setLayoutState] = useState<Layout>(readFromStorage);

  useEffect(() => {
    const sync = () => setLayoutState(readFromStorage());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setLayout = useCallback((next: Layout) => {
    let persisted = true;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Quota exceeded or storage denied; in-memory state still updates
      // so the UI flips for this session, but skip the cross-instance
      // sync event so other live hooks don't overwrite their state from
      // the stale stored value.
      persisted = false;
    }
    setLayoutState(next);
    if (persisted) {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }
  }, []);

  return [layout, setLayout] as const;
};

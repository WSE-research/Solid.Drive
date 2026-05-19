/**
 * Hook for reading and persisting whether the OneDrive nav rail is
 * shown in its expanded pane or the icon-only rail.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'solid-drive.navRailExpanded';
const CHANGE_EVENT = 'solid-drive:nav-rail-expanded-changed';
const DEFAULT_EXPANDED = true;

const readFromStorage = (): boolean => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return DEFAULT_EXPANDED;
  } catch {
    return DEFAULT_EXPANDED;
  }
};

/**
 * Returns `[expanded, setExpanded]` for the nav rail. Persisted in
 * `localStorage`. Defaults to `true`. Live instances stay in sync
 * via a custom event and the cross-tab `storage` event.
 *
 * @public
 */
export const useNavRailExpanded = (): readonly [boolean, (next: boolean) => void] => {
  const [expanded, setExpandedState] = useState<boolean>(readFromStorage);

  useEffect(() => {
    const sync = () => setExpandedState(readFromStorage());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setExpanded = useCallback((next: boolean) => {
    let persisted = true;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      persisted = false;
    }
    setExpandedState(next);
    if (persisted) {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }
  }, []);

  return [expanded, setExpanded] as const;
};

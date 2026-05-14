/**
 * Hook for reading and persisting the user's layout preference
 * (classic explorer vs OneDrive-inspired layout).
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
 * receive untyped values (URL params, DOM event payloads, Radix value
 * callbacks, …) can narrow them with the same single source of truth as the
 * hook itself.
 *
 * @public
 */
export const isLayout = (value: unknown): value is Layout =>
  value === 'classic' || value === 'onedrive';

const readFromStorage = (): Layout => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isLayout(stored) ? stored : 'classic';
};

/**
 * Reads/writes the active layout preference, persisting to localStorage.
 * Defaults to "classic" so existing users see no change on first load.
 * Corrupted or missing values fall back to "classic".
 *
 * Multiple hook instances stay in sync: every setter dispatches a custom
 * event that all live instances listen for, so flipping the preference
 * from one component immediately updates every other component reading it.
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
    localStorage.setItem(STORAGE_KEY, next);
    setLayoutState(next);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }, []);

  return [layout, setLayout] as const;
};

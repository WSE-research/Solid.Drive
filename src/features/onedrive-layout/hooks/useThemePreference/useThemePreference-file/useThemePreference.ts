/**
 * Hook for reading and persisting the user's choice between the dark
 * and light OneDrive themes.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'solid-drive.theme';
const CHANGE_EVENT = 'solid-drive:theme-changed';
const DEFAULT_THEME: Theme = 'dark';
const THEME_ATTRIBUTE = 'data-theme';

/**
 * Type guard for the {@link Theme} union.
 *
 * @public
 */
export const isTheme = (value: unknown): value is Theme =>
  value === 'dark' || value === 'light';

const readFromStorage = (): Theme => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
};

const tryPersist = (theme: Theme): boolean => {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
    return true;
  } catch {
    return false;
  }
};

const applyTheme = (theme: Theme): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
};

/**
 * Applies the stored theme to `document.documentElement` synchronously.
 * Call once before React mounts to prevent a flash of the wrong theme.
 *
 * @public
 */
export const applyStoredTheme = (): void => {
  applyTheme(readFromStorage());
};

/**
 * Reads and writes the active theme, persisting to localStorage and
 * mirroring the value onto `document.documentElement` as
 * `data-theme="dark"` or `data-theme="light"`. Defaults to `dark`.
 *
 * Live instances stay in sync via a custom event plus the cross-tab
 * `storage` event.
 *
 * @public
 */
export const useThemePreference = (): readonly [Theme, (next: Theme) => void] => {
  const [theme, setThemeState] = useState<Theme>(readFromStorage);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const sync = () => setThemeState(readFromStorage());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setTheme = useCallback((next: Theme) => {
    const persisted = tryPersist(next);
    setThemeState(next);
    applyTheme(next);
    if (persisted) {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }
  }, []);

  return [theme, setTheme] as const;
};

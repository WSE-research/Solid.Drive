/**
 * Hook for reading and persisting the user's theme choice.
 *
 * Four themes ship today: the dark and light OneDrive themes, a
 * Dropbox-inspired light theme, and a Google-Drive-inspired light theme.
 * All of them restyle the same layout — each is a `--odl-*` token map plus a
 * small set of direct rules, keyed off the `data-theme` attribute on the
 * document element.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light' | 'dropbox' | 'gdrive';

/**
 * Every valid {@link Theme}, in the order the picker offers them. Exported so
 * the picker and the type guard cannot drift apart when a theme is added.
 *
 * @public
 */
export const THEMES = ['light', 'dark', 'dropbox', 'gdrive'] as const satisfies readonly Theme[];

const STORAGE_KEY = 'solid-drive.theme';
const CHANGE_EVENT = 'solid-drive:theme-changed';
const THEME_ATTRIBUTE = 'data-theme';

/** The theme applied when nothing is stored. */
const DEFAULT_THEME: Theme = 'dark';

/**
 * Type guard for the {@link Theme} union.
 *
 * @public
 */
export const isTheme = (value: unknown): value is Theme =>
  (THEMES as readonly string[]).includes(value as string);

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
 * mirroring the value onto `document.documentElement` as `data-theme`
 * (`dark`, `light` or `dropbox`). Defaults to `dark`.
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

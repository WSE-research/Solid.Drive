/**
 * Hook for reading and persisting the user's accent color scheme for the
 * OneDrive layout. Orthogonal to {@link useThemePreference} (dark/light):
 * the scheme only re-tints the accent and brand tokens, so it combines
 * with either theme.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useState } from 'react';

/** The selectable accent palettes. `indigo` is the default Solid.drive look. */
export type ColorScheme = 'indigo' | 'emerald' | 'amber' | 'rose';

/** All schemes, in display order. */
export const COLOR_SCHEMES: readonly ColorScheme[] = ['indigo', 'emerald', 'amber', 'rose'] as const;

const STORAGE_KEY = 'solid-drive.color-scheme';
const CHANGE_EVENT = 'solid-drive:color-scheme-changed';
const DEFAULT_SCHEME: ColorScheme = 'indigo';
const SCHEME_ATTRIBUTE = 'data-scheme';

/**
 * Type guard for the {@link ColorScheme} union.
 *
 * @public
 */
export const isColorScheme = (value: unknown): value is ColorScheme =>
  typeof value === 'string' && (COLOR_SCHEMES as readonly string[]).includes(value);

const readFromStorage = (): ColorScheme => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isColorScheme(stored) ? stored : DEFAULT_SCHEME;
  } catch {
    return DEFAULT_SCHEME;
  }
};

const tryPersist = (scheme: ColorScheme): boolean => {
  try {
    window.localStorage.setItem(STORAGE_KEY, scheme);
    return true;
  } catch {
    return false;
  }
};

const applyScheme = (scheme: ColorScheme): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute(SCHEME_ATTRIBUTE, scheme);
};

/**
 * Applies the stored color scheme to `document.documentElement`
 * synchronously. Call once before React mounts to prevent a flash of the
 * wrong accent.
 *
 * @public
 */
export const applyStoredColorScheme = (): void => {
  applyScheme(readFromStorage());
};

/**
 * Reads and writes the active color scheme, persisting to localStorage
 * and mirroring the value onto `document.documentElement` as
 * `data-scheme="indigo|emerald|amber|rose"`. Defaults to `indigo`.
 *
 * Live instances stay in sync via a custom event plus the cross-tab
 * `storage` event.
 *
 * @public
 */
export const useColorScheme = (): readonly [ColorScheme, (next: ColorScheme) => void] => {
  const [scheme, setSchemeState] = useState<ColorScheme>(readFromStorage);

  useEffect(() => {
    applyScheme(scheme);
  }, [scheme]);

  useEffect(() => {
    const sync = () => setSchemeState(readFromStorage());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setScheme = useCallback((next: ColorScheme) => {
    const persisted = tryPersist(next);
    setSchemeState(next);
    applyScheme(next);
    if (persisted) {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }
  }, []);

  return [scheme, setScheme] as const;
};

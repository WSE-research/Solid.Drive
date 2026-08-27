/**
 * Hook exposing the layout and theme preferences as one "experience" value:
 * the classic shell, or the OneDrive shell wearing one of its themes.
 *
 * The two stored preferences are orthogonal — `solid-drive.layout` picks the
 * shell, `solid-drive.theme` restyles the OneDrive one — but users pick a
 * *look*, not a pair of axes. Both places that offer the look as one flat
 * list (the landing page's experience picker before login, the classic
 * header's switcher after it) go through this hook, so the rule for what a
 * pick writes lives in exactly one place.
 *
 * @packageDocumentation
 */

import { useCallback } from 'react';
import { useLayoutPreference } from '@/features/onedrive-layout/hooks/useLayoutPreference';
import {
  THEMES,
  useThemePreference,
  type Theme,
} from '@/features/onedrive-layout/hooks/useThemePreference';

/**
 * What the user picks: the classic layout, or one theme of the OneDrive
 * shell. Every theme is its own experience — the theme axis is not a hidden
 * second step behind a single "OneDrive" entry.
 *
 * @public
 */
export type Experience = 'classic' | Theme;

/**
 * Every valid {@link Experience}, in the order the pickers offer them.
 * Derived from `THEMES`, so a new theme joins every experience picker by
 * construction.
 *
 * @public
 */
export const EXPERIENCES = ['classic', ...THEMES] as const satisfies readonly Experience[];

/**
 * Type guard for the {@link Experience} union. Exported so call sites that
 * receive untyped values from DOM events can narrow them against a single
 * source of truth.
 *
 * @public
 */
export const isExperience = (value: unknown): value is Experience =>
  (EXPERIENCES as readonly string[]).includes(value as string);

/**
 * Reads and writes the active experience, translating it into the two
 * preferences underneath.
 *
 * Picking a theme writes BOTH halves (layout `onedrive` plus that theme), so
 * one interaction lands the user in the restyled shell. Picking `classic`
 * moves only the layout axis: the theme styles the OneDrive shell alone, and
 * the last theme choice should survive a later return to it.
 *
 * @public
 */
export const useExperiencePreference = (): readonly [
  Experience,
  (next: Experience) => void,
] => {
  const [layout, setLayout] = useLayoutPreference();
  const [theme, setTheme] = useThemePreference();

  const experience: Experience = layout === 'onedrive' ? theme : 'classic';

  const setExperience = useCallback(
    (next: Experience) => {
      if (next === 'classic') {
        setLayout('classic');
        return;
      }
      setLayout('onedrive');
      if (next !== theme) setTheme(next);
    },
    [setLayout, setTheme, theme],
  );

  return [experience, setExperience] as const;
};

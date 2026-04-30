/**
 * Hook reading and writing the active view via the ?view= URL query param.
 * Uses URLSearchParams + history.replaceState (no router dependency) and
 * subscribes to popstate so back/forward navigation works.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useState } from 'react';

/**
 * Identifier for one of the OneDriveLayout views, matching the rail icons.
 */
export type ViewId =
  | 'recent'
  | 'my-files'
  | 'shared'
  | 'requests'
  | 'people';

const VIEW_IDS: readonly ViewId[] = [
  'recent',
  'my-files',
  'shared',
  'requests',
  'people',
] as const;

const DEFAULT_VIEW: ViewId = 'recent';
const CHANGE_EVENT = 'solid-drive:view-changed';

const isViewId = (value: unknown): value is ViewId =>
  typeof value === 'string' && (VIEW_IDS as readonly string[]).includes(value);

const readViewFromUrl = (): ViewId => {
  const raw = new URLSearchParams(window.location.search).get('view');
  return isViewId(raw) ? raw : DEFAULT_VIEW;
};

/**
 * Returns the active view id and a setter that writes ?view= to the URL.
 *
 * Multiple hook instances stay in sync: every setter dispatches a custom
 * event that all live instances listen for, so flipping the view from one
 * component (e.g. NavRail) immediately re-renders every other component
 * reading it (e.g. OneDriveLayout's main panel). This is necessary because
 * `history.replaceState` does NOT fire `popstate` on the same tab.
 *
 * @public
 */
export const useViewParam = (): readonly [ViewId, (next: ViewId) => void] => {
  const [view, setView] = useState<ViewId>(readViewFromUrl);

  useEffect(() => {
    const sync = () => setView(readViewFromUrl());
    window.addEventListener('popstate', sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);

  const update = useCallback((next: ViewId) => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', next);
    window.history.replaceState({}, '', url);
    setView(next);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }, []);

  return [view, update] as const;
};

/**
 * Wraps the file-explorer navigation handlers so browser-back and
 * forward navigate the My Files folder stack, and so scroll position is
 * preserved when navigating in and out of folders.
 *
 * The hook stores a snapshot of the breadcrumb stack in `history.state`
 * on every push, and restores it on `popstate`. Scroll position is kept
 * in a ref-keyed map and restored after navigation.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SolidContainerUri } from '@ldo/connected-solid';
import type { Breadcrumb } from '@/features/file-explorer/hooks/useDriveInitialization';

const HISTORY_MARKER = 'odl-my-files';

interface OdlHistoryState {
  marker: typeof HISTORY_MARKER;
  currentUri: string;
  breadcrumbs: Breadcrumb[];
}

const isOdlState = (value: unknown): value is OdlHistoryState =>
  !!value &&
  typeof value === 'object' &&
  (value as { marker?: unknown }).marker === HISTORY_MARKER;

export interface UseNavigationHistoryArgs {
  currentUri: SolidContainerUri | undefined;
  breadcrumbs: Breadcrumb[];
  setCurrentUri: (uri: SolidContainerUri | undefined) => void;
  setBreadcrumbs: Dispatch<SetStateAction<Breadcrumb[]>>;
}

export interface UseNavigationHistoryReturn {
  navigate: (uri: string, label: string) => void;
  navigateToCrumb: (index: number, uri: SolidContainerUri) => void;
  attachScrollContainer: (element: HTMLElement | null) => void;
}

export function useNavigationHistory({
  currentUri,
  breadcrumbs,
  setCurrentUri,
  setBreadcrumbs,
}: UseNavigationHistoryArgs): UseNavigationHistoryReturn {
  const scrollMapRef = useRef<Map<string, number>>(new Map());
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  const captureScroll = useCallback(() => {
    if (!scrollContainerRef.current || !currentUri) return;
    scrollMapRef.current.set(currentUri, scrollContainerRef.current.scrollTop);
  }, [currentUri]);

  const restoreScroll = useCallback((uri: string) => {
    if (!scrollContainerRef.current) return;
    const saved = scrollMapRef.current.get(uri) ?? 0;
    // Defer to next frame so the new content has rendered.
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = saved;
      }
    });
  }, []);

  const navigate = useCallback(
    (uri: string, label: string) => {
      captureScroll();
      const nextBreadcrumbs: Breadcrumb[] = [
        ...breadcrumbs,
        { label, uri: uri as SolidContainerUri },
      ];
      const state: OdlHistoryState = {
        marker: HISTORY_MARKER,
        currentUri: uri,
        breadcrumbs: nextBreadcrumbs,
      };
      window.history.pushState(state, '');
      setBreadcrumbs(nextBreadcrumbs);
      setCurrentUri(uri as SolidContainerUri);
      restoreScroll(uri);
    },
    [breadcrumbs, captureScroll, restoreScroll, setBreadcrumbs, setCurrentUri],
  );

  const navigateToCrumb = useCallback(
    (index: number, uri: SolidContainerUri) => {
      captureScroll();
      const nextBreadcrumbs = breadcrumbs.slice(0, index + 1);
      const state: OdlHistoryState = {
        marker: HISTORY_MARKER,
        currentUri: uri,
        breadcrumbs: nextBreadcrumbs,
      };
      window.history.pushState(state, '');
      setBreadcrumbs(nextBreadcrumbs);
      setCurrentUri(uri);
      restoreScroll(uri);
    },
    [breadcrumbs, captureScroll, restoreScroll, setBreadcrumbs, setCurrentUri],
  );

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      if (!isOdlState(event.state)) return;
      const { currentUri: targetUri, breadcrumbs: targetBreadcrumbs } =
        event.state;
      setBreadcrumbs(targetBreadcrumbs);
      setCurrentUri(targetUri as SolidContainerUri);
      restoreScroll(targetUri);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [restoreScroll, setBreadcrumbs, setCurrentUri]);

  const attachScrollContainer = useCallback((element: HTMLElement | null) => {
    scrollContainerRef.current = element;
  }, []);

  return { navigate, navigateToCrumb, attachScrollContainer };
}

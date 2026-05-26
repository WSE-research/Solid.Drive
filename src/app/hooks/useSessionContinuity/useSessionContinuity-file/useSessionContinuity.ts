/**
 * Tracks whether the user is, was just, or is about to be logged in
 * within the current browser tab. The Solid auth provider needs about
 * a second after page load to restore a saved session or to finish an
 * OIDC redirect, and during that window
 * `useSolidAuth().session.isLoggedIn` is `false`.
 *
 * Two flags are exposed so AppShell can pick the right placeholder:
 *
 * - `assumeLoggedIn` is `true` while a real session is active or while
 *   one is being restored after a refresh. The hook persists this via
 *   `sessionStorage` so it survives a reload inside the OneDrive layout.
 * - `isAuthenticating` is `true` when the current URL carries OIDC
 *   redirect parameters (`code` + `state`) and either the handshake is
 *   still resolving or the post-callback boot window has not yet
 *   elapsed. AppShell renders a skeleton during this window so the
 *   chosen layout gets a head start on pod discovery and the user
 *   never sees an empty loading shell.
 *
 * The boot window has two bounds. A minimum hold (2.5s) keeps the
 * skeleton up long enough to feel intentional even when auth resolves
 * almost instantly. A maximum hold (10s) makes sure a stuck or failed
 * handshake never traps the user behind the skeleton forever; once it
 * elapses we lift no matter what auth is doing.
 *
 * @packageDocumentation
 */

import { useEffect, useRef, useState } from 'react';
import { useSolidAuth } from '@ldo/solid-react';

const SESSION_FLAG_KEY = 'solid-drive.session-active';

const HANDSHAKE_MIN_DISPLAY_MS = 2500;
const HANDSHAKE_MAX_DISPLAY_MS = 10000;

/**
 * @public
 */
export interface SessionContinuity {
  /** Treat the user as logged in (real session or post-refresh restore). */
  assumeLoggedIn: boolean;
  /** Keep showing the auth-callback skeleton until auth resolves and the boot window elapses. */
  isAuthenticating: boolean;
}

const hasAuthCallbackParams = (): boolean => {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.has('code') && params.has('state');
  } catch {
    return false;
  }
};

/**
 * @public
 */
export const useSessionContinuity = (): SessionContinuity => {
  const { session } = useSolidAuth();
  const [wasActiveOnMount] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(SESSION_FLAG_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [hadCallbackOnMount] = useState<boolean>(hasAuthCallbackParams);
  const wasLoggedInRef = useRef(false);
  const [authObserved, setAuthObserved] = useState(false);
  const [minHoldElapsed, setMinHoldElapsed] = useState(!hadCallbackOnMount);
  const [maxHoldElapsed, setMaxHoldElapsed] = useState(!hadCallbackOnMount);

  useEffect(() => {
    if (session.isLoggedIn) {
      wasLoggedInRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- observing external auth state
      setAuthObserved(true);
      try { sessionStorage.setItem(SESSION_FLAG_KEY, '1'); } catch { /* storage unavailable */ }
      return;
    }
    if (wasLoggedInRef.current) {
      setAuthObserved(true);
      try { sessionStorage.removeItem(SESSION_FLAG_KEY); } catch { /* storage unavailable */ }
    }
  }, [session.isLoggedIn]);

  useEffect(() => {
    if (!hadCallbackOnMount) return undefined;
    const minTimer = setTimeout(() => setMinHoldElapsed(true), HANDSHAKE_MIN_DISPLAY_MS);
    const maxTimer = setTimeout(() => setMaxHoldElapsed(true), HANDSHAKE_MAX_DISPLAY_MS);
    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
    };
  }, [hadCallbackOnMount]);

  const assumeLoggedIn = session.isLoggedIn || (!authObserved && wasActiveOnMount);
  const isAuthenticating =
    hadCallbackOnMount && !maxHoldElapsed && (!authObserved || !minHoldElapsed);

  return { assumeLoggedIn, isAuthenticating };
};

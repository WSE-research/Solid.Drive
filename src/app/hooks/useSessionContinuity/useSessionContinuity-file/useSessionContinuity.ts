/**
 * Tracks whether the user "is or was just" logged in within the current
 * browser tab. The Solid auth provider needs ~1s after page load to restore
 * a saved session — during that window `useSolidAuth().session.isLoggedIn`
 * is `false`. Without this hook, refreshing while in OneDrive layout would
 * flash the classic Header + FileExplorer until auth resolved.
 *
 * Returns `true` when:
 * - the user is currently logged in (the truth source), OR
 * - we observed an active session earlier in this tab session and auth has
 *   not yet been resolved (sessionStorage persists across refreshes but is
 *   cleared when the tab closes, matching the Solid session lifetime).
 *
 * The flag is cleared automatically when the user truly logs out (a
 * transition from `isLoggedIn=true` back to `isLoggedIn=false`).
 *
 * @packageDocumentation
 */

import { useEffect, useRef, useState } from 'react';
import { useSolidAuth } from '@ldo/solid-react';

const SESSION_FLAG_KEY = 'solid-drive.session-active';

/**
 * Returns whether the app should treat the user as logged in for shell
 * routing purposes — true while a real session is active OR while one is
 * being restored after a refresh.
 *
 * @public
 */
export const useSessionContinuity = (): boolean => {
  const { session } = useSolidAuth();
  const [wasActiveOnMount] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(SESSION_FLAG_KEY) === '1';
    } catch {
      return false;
    }
  });
  const wasLoggedInRef = useRef(false);
  const [authObserved, setAuthObserved] = useState(false);

  useEffect(() => {
    if (session.isLoggedIn) {
      wasLoggedInRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- observing external auth state
      setAuthObserved(true);
      try { sessionStorage.setItem(SESSION_FLAG_KEY, '1'); } catch { /* storage unavailable */ }
      return;
    }
    if (wasLoggedInRef.current) {
      // We saw an active session and now it's gone → the user explicitly logged out.
      setAuthObserved(true);
      try { sessionStorage.removeItem(SESSION_FLAG_KEY); } catch { /* storage unavailable */ }
    }
  }, [session.isLoggedIn]);

  return session.isLoggedIn || (!authObserved && wasActiveOnMount);
};

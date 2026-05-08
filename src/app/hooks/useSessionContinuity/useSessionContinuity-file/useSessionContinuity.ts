/**
 * Tracks whether the user is or was just logged in within the current
 * browser tab. The Solid auth provider needs about a second after page
 * load to restore a saved session, and during that window
 * `useSolidAuth().session.isLoggedIn` is `false`. Without this hook,
 * refreshing inside the OneDrive layout would flash the classic header
 * and file explorer until auth resolved.
 *
 * Returns `true` while a real session is active or while one is being
 * restored after a refresh. The flag is cleared automatically when the
 * user truly logs out.
 *
 * @packageDocumentation
 */

import { useEffect, useRef, useState } from 'react';
import { useSolidAuth } from '@ldo/solid-react';

const SESSION_FLAG_KEY = 'solid-drive.session-active';

/**
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
      // The previously-active session is gone, so the user logged out.
      setAuthObserved(true);
      try { sessionStorage.removeItem(SESSION_FLAG_KEY); } catch { /* storage unavailable */ }
    }
  }, [session.isLoggedIn]);

  return session.isLoggedIn || (!authObserved && wasActiveOnMount);
};

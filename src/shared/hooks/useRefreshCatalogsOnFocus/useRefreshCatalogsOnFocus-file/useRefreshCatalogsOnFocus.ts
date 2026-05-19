/**
 * Refreshes cached catalogs when the tab regains focus, so changes
 * made from another tab or device appear without a manual reload.
 * In-flight dedupe in the cache layer collapses any overlap between
 * the focus and visibilitychange events.
 *
 * @packageDocumentation
 */

import { useEffect } from 'react';
import { notifyCatalogChanged } from '@/shared/hooks/useCatalogVersion';
import { notifySharedCatalogsChanged } from '@/shared/hooks/useSharedCatalogVersion';

const FOCUS_EVENT = 'focus';
const VISIBILITY_CHANGE_EVENT = 'visibilitychange';
const VISIBLE_STATE = 'visible';

/**
 * Listens for window focus and visibilitychange events and notifies every
 * catalog consumer that their cached data may be stale.
 *
 * @param catalogUri - Optional URI of the user's own catalog. When set, a
 * per-URI notification is fired in addition to the global shared-catalog
 * notification.
 *
 * @public
 */
export function useRefreshCatalogsOnFocus(catalogUri: string | undefined): void {
  useEffect(() => {
    const refresh = (): void => {
      if (catalogUri) notifyCatalogChanged(catalogUri);
      notifySharedCatalogsChanged();
    };
    const handleVisibility = (): void => {
      if (document.visibilityState === VISIBLE_STATE) refresh();
    };
    window.addEventListener(FOCUS_EVENT, refresh);
    document.addEventListener(VISIBILITY_CHANGE_EVENT, handleVisibility);
    return () => {
      window.removeEventListener(FOCUS_EVENT, refresh);
      document.removeEventListener(VISIBILITY_CHANGE_EVENT, handleVisibility);
    };
  }, [catalogUri]);
}

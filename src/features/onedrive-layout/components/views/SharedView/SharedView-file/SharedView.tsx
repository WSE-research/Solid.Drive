/**
 * Shared view for the OneDrive inspired layout.
 *
 * Returns two sibling elements:
 *   - `<shared-toolbar>`: claims the OneDriveLayout `toolbar` grid area
 *     and replaces the page-header title row.
 *   - `<shared-body>`: claims the `main` grid area.
 *
 * Both siblings share the filter state, the active tab, and the
 * observed-types collector so the chip set is always derived from the
 * actual catalog data of whichever tab is active. Switching tabs
 * resets the chip selection and the observed-types collector so the
 * other tab does not leak into the new one.
 *
 * @packageDocumentation
 */

import { useCallback, useState } from 'react';
import type { FunctionComponent } from 'react';
import { useSolidAuth } from '@ldo/solid-react';
import { useContacts } from '@/features/file-explorer/hooks/useContacts';
import { useSharedFilters } from '@/features/onedrive-layout/hooks/useSharedFilters';
import { notifySharedCatalogsChanged } from '@/shared/hooks/useSharedCatalogVersion';
import { SharedToolbar, type SharedTabId } from './SharedToolbar';
import { SharedBody } from './SharedBody';
import { useObservedSharedTypes } from './useObservedSharedTypes';

/**
 * Renders the SharedView as a toolbar and body sibling pair.
 *
 * @public
 */
export const SharedView: FunctionComponent = () => {
  const { session } = useSolidAuth();
  const contacts = useContacts();
  const filters = useSharedFilters();
  const { chips, report, reset } = useObservedSharedTypes();
  const [tab, setTab] = useState<SharedTabId>('with-you');

  const ownerWebId = session.webId ?? '';
  const otherContacts = contacts.filter((webId: string) => webId !== ownerWebId);

  const handleTabChange = useCallback(
    (next: SharedTabId) => {
      setTab((current) => {
        if (current === next) return current;
        filters.resetClasses();
        reset();
        notifySharedCatalogsChanged();
        return next;
      });
    },
    [filters, reset],
  );

  return (
    <>
      <SharedToolbar
        tab={tab}
        onTabChange={handleTabChange}
        chips={chips}
        filters={filters}
      />
      <SharedBody
        tab={tab}
        contacts={otherContacts}
        viewerWebId={ownerWebId}
        filters={filters}
        chips={chips}
        onObserve={report}
      />
    </>
  );
};

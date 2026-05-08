/**
 * Home / Recent view for the OneDrive inspired layout.
 *
 * Reads the user's catalog, sorts entries by `modified` desc, and
 * surfaces them in a flat Name / Opened / Owner table that mirrors the
 * OneDrive Home recent section. The toolbar above carries the type
 * chips derived from the catalog's observed schema.org classes plus a
 * person/name filter input.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSolidAuth, useSubject } from '@ldo/solid-react';
import { SolidProfileShapeType } from '@/.ldo/solidProfile.shapeTypes';
import { resolveCatalogUri } from '@/infrastructure/solid/catalog';
import { useDriveInitialization } from '@/features/file-explorer/hooks/useDriveInitialization';
import { useCatalog } from '@/features/file-explorer/hooks/useCatalog';
import { getProfileDisplayName } from '@/shared/utils/getProfileDisplayName';
import {
  TypeFilterChips,
  TypeFilterChipsDropdown,
} from '@/features/onedrive-layout/components/filters/TypeFilterChips';
import { PersonNameFilter } from '@/features/onedrive-layout/components/filters/PersonNameFilter';
import { useRecentFilters } from '@/features/onedrive-layout/hooks/useRecentFilters';
import { RecentFilesTable } from './RecentFilesTable';

/**
 * Renders the Home / Recent view body.
 *
 * @public
 */
export const RecentView: FunctionComponent = () => {
  const [translate] = useTranslation();
  const { session } = useSolidAuth();
  const { storageRootUri } = useDriveInitialization();
  const profile = useSubject(SolidProfileShapeType, session.webId);
  const catalogUri = resolveCatalogUri(profile, storageRootUri);
  const { entries: catalogEntries } = useCatalog(catalogUri);

  const ownerWebId = session.webId ?? '';
  const ownerName = getProfileDisplayName(profile, ownerWebId);

  const {
    chips,
    selectedChips,
    query,
    visibleEntries,
    setQuery,
    toggleChip,
    resetChips,
  } = useRecentFilters({ catalogEntries, ownerName });

  return (
    <onedrive-view data-view-id="recent">
      <recent-toolbar>
        <h2 className="odl-recent__heading">
          {translate('oneDriveLayout.recentView.heading', 'Recent')}
        </h2>

        <recent-toolbar-chips className="odl-shared-toolbar__chips--inline">
          <TypeFilterChips
            chips={chips}
            selected={selectedChips}
            onToggle={toggleChip}
            onReset={resetChips}
          />
        </recent-toolbar-chips>
        <recent-toolbar-chips className="odl-shared-toolbar__chips--collapsed">
          <TypeFilterChipsDropdown
            chips={chips}
            selected={selectedChips}
            onToggle={toggleChip}
            onReset={resetChips}
          />
        </recent-toolbar-chips>

        <recent-toolbar-search>
          <PersonNameFilter value={query} onChange={setQuery} />
        </recent-toolbar-search>
      </recent-toolbar>

      <RecentFilesTable entries={visibleEntries} ownerName={ownerName} />
    </onedrive-view>
  );
};

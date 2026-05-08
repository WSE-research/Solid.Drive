/**
 * Toolbar that occupies the page-header grid slot when the user is on
 * the Shared view: tabs (With you / By you), filter chips derived from
 * the catalog, and the person/name filter input.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TypeFilterChips,
  TypeFilterChipsDropdown,
} from '@/features/onedrive-layout/components/filters/TypeFilterChips';
import { PersonNameFilter } from '@/features/onedrive-layout/components/filters/PersonNameFilter';
import type { FilterChipDef } from '@/features/onedrive-layout/components/filters/TypeFilterChips/TypeFilterChips-file/chipCatalog';
import type { SharedFilters } from '@/features/onedrive-layout/hooks/useSharedFilters';

/**
 * Active tab id. Lifted to the parent so the body can read it too.
 *
 * @public
 */
export type SharedTabId = 'with-you' | 'by-you';

/**
 * Props for {@link SharedToolbar}.
 *
 * @public
 */
export interface SharedToolbarProps {
  tab: SharedTabId;
  onTabChange: (next: SharedTabId) => void;
  chips: readonly FilterChipDef[];
  filters: SharedFilters;
}

/**
 * Renders the SharedView toolbar.
 *
 * @public
 */
export const SharedToolbar: FunctionComponent<SharedToolbarProps> = ({
  tab,
  onTabChange,
  chips,
  filters,
}) => {
  const [translate] = useTranslation();

  return (
    <shared-toolbar>
      <shared-toolbar-tabs role="tablist" aria-label={translate('oneDriveLayout.viewTitle.shared', 'Shared')}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'with-you'}
          className={`odl-shared-tabs__trigger${tab === 'with-you' ? ' odl-shared-tabs__trigger--active' : ''}`}
          onClick={() => onTabChange('with-you')}
        >
          {translate('oneDriveLayout.sharedView.tab.withYou', 'With you')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'by-you'}
          className={`odl-shared-tabs__trigger${tab === 'by-you' ? ' odl-shared-tabs__trigger--active' : ''}`}
          onClick={() => onTabChange('by-you')}
        >
          {translate('oneDriveLayout.sharedView.tab.byYou', 'By you')}
        </button>
      </shared-toolbar-tabs>

      {/*
        Three responsive states share filter state:
          - wide: full inline chips with text labels
          - medium: collapsed "All ▼" dropdown when text would crowd
          - narrow: inline chips with text hidden (icon-only)
        CSS media queries decide which container is visible. The
        narrow state reuses the inline chips and just hides their
        text labels, so we mount only two components in total.
      */}
      <shared-toolbar-chips className="odl-shared-toolbar__chips--inline">
        <TypeFilterChips
          chips={chips}
          selected={filters.selectedClasses}
          onToggle={filters.toggleClass}
          onReset={filters.resetClasses}
        />
      </shared-toolbar-chips>
      <shared-toolbar-chips className="odl-shared-toolbar__chips--collapsed">
        <TypeFilterChipsDropdown
          chips={chips}
          selected={filters.selectedClasses}
          onToggle={filters.toggleClass}
          onReset={filters.resetClasses}
        />
      </shared-toolbar-chips>

      <shared-toolbar-search>
        <PersonNameFilter
          value={filters.personQuery}
          onChange={filters.setPersonQuery}
        />
      </shared-toolbar-search>
    </shared-toolbar>
  );
};

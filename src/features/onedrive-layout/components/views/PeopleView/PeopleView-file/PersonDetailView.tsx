/**
 * Person detail view for the OneDrive inspired People surface.
 *
 * Activates when the user clicks a contact in the People list. The
 * surface mirrors the SharedView's With-you tab — chip filters,
 * person/name input, and the same {@link SharedFilesTable} body — but
 * scoped to a single contact and headed with the contact's avatar,
 * display name, and a "Back to People" link.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/shared/components/Avatar';
import { useContactProfile } from '@/shared/hooks/useContactProfile';
import { useSharedFilters } from '@/features/onedrive-layout/hooks/useSharedFilters';
import {
  TypeFilterChips,
  TypeFilterChipsDropdown,
} from '@/features/onedrive-layout/components/filters/TypeFilterChips';
import { PersonNameFilter } from '@/features/onedrive-layout/components/filters/PersonNameFilter';
import { ChevronLeftIcon } from '@/features/onedrive-layout/icons';
import { SharedFilesTable } from '@/features/onedrive-layout/components/views/SharedView/SharedView-file/SharedFilesTable';
import { useObservedSharedTypes } from '@/features/onedrive-layout/components/views/SharedView/SharedView-file/useObservedSharedTypes';

/**
 * Props for {@link PersonDetailView}.
 *
 * @public
 */
export interface PersonDetailViewProps {
  /** Selected contact's WebID. */
  contactWebId: string;
  /** Current user's WebID — used as the catalog viewer. */
  ownerWebId: string;
  /** Returns the user to the People list. */
  onBack: () => void;
}

/**
 * Renders the per-contact files surface.
 *
 * @public
 */
export const PersonDetailView: FunctionComponent<PersonDetailViewProps> = ({
  contactWebId,
  ownerWebId,
  onBack,
}) => {
  const [translate] = useTranslation();
  const { displayName, avatarUrl, initial } = useContactProfile(contactWebId);
  const filters = useSharedFilters();
  const { chips, report } = useObservedSharedTypes();

  return (
    <onedrive-view data-view-id="people-detail">
      <button
        type="button"
        className="odl-people-back"
        onClick={onBack}
      >
        <ChevronLeftIcon aria-hidden focusable={false} />
        <span>
          {translate('oneDriveLayout.peopleView.back', 'Back to People')}
        </span>
      </button>

      {/*
        Reuse `shared-toolbar` so the toolbar's grid + responsive
        breakpoints (chip-row → dropdown → icon-only) carry over for
        free; the only difference vs the SharedToolbar is the leading
        slot, which here renders the contact's identity instead of
        With-you / By-you tabs.
      */}
      <shared-toolbar>
        <person-detail-identity>
          <Avatar
            size="md"
            src={avatarUrl}
            alt={displayName}
            initial={initial}
          />
          <h2 className="odl-person-detail__name">{displayName}</h2>
        </person-detail-identity>

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

      <SharedFilesTable
        contacts={[contactWebId]}
        viewerWebId={ownerWebId}
        direction="with-you"
        filters={filters}
        chips={chips}
        onObserve={report}
      />
    </onedrive-view>
  );
};

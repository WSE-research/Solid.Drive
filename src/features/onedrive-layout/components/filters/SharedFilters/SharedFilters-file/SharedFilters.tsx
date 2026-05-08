/**
 * Layout shell that pairs the {@link TypeFilterChips} chip row with the
 * {@link PersonNameFilter} input. Pure presentational — all state comes
 * from {@link useSharedFilters} via the parent.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import {
  TypeFilterChips,
  type FilterChipDef,
} from '@/features/onedrive-layout/components/filters/TypeFilterChips';
import { PersonNameFilter } from '@/features/onedrive-layout/components/filters/PersonNameFilter';
import type { SharedFilters as SharedFiltersState } from '@/features/onedrive-layout/hooks/useSharedFilters';

/**
 * Props for {@link SharedFilters}.
 *
 * @public
 */
export interface SharedFiltersProps {
  /** Chip set derived from observed entries. */
  chips: readonly FilterChipDef[];
  /** State + actions from {@link useSharedFilters}. */
  filters: SharedFiltersState;
}

/**
 * Renders the chip row above the person filter, scoped under the
 * `<shared-filters>` element so the layout CSS can target it.
 *
 * @public
 */
export const SharedFilters: FunctionComponent<SharedFiltersProps> = ({
  chips,
  filters,
}) => {
  return (
    <shared-filters>
      <TypeFilterChips
        chips={chips}
        selected={filters.selectedClasses}
        onToggle={filters.toggleClass}
        onReset={filters.resetClasses}
      />
      <PersonNameFilter
        value={filters.personQuery}
        onChange={filters.setPersonQuery}
      />
    </shared-filters>
  );
};

/**
 * Body for the SharedView. Switches between the With-you and By-you
 * tables based on the active tab; both tabs are backed by the same
 * {@link SharedFilesTable}, only the catalog read direction differs.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { SharedFilesTable } from './SharedFilesTable';
import type { SharedTabId } from './SharedToolbar';
import type { SharedSelection } from './useSharedSelection';
import type { FilterChipDef } from '@/features/onedrive-layout/components/filters/TypeFilterChips/TypeFilterChips-file/chipCatalog';
import type { SharedFilters } from '@/features/onedrive-layout/hooks/useSharedFilters';

/**
 * Props for {@link SharedBody}. The shape mirrors what
 * {@link SharedFilesTable} needs, plus the active tab so the body can
 * pick which catalog direction to read.
 *
 * @public
 */
export interface SharedBodyProps {
  tab: SharedTabId;
  contacts: string[];
  viewerWebId: string;
  filters: SharedFilters;
  chips: readonly FilterChipDef[];
  onObserve: (
    key: string,
    report: { classes: ReadonlySet<string>; hasFolder: boolean; hasPdf: boolean },
  ) => void;
  selectedEntryUri?: string;
  onSelect: (next: SharedSelection) => void;
}

/**
 * Renders the table for whichever tab is currently active.
 *
 * @public
 */
export const SharedBody: FunctionComponent<SharedBodyProps> = ({
  tab,
  contacts,
  viewerWebId,
  filters,
  chips,
  onObserve,
  selectedEntryUri,
  onSelect,
}) => {
  return (
    <shared-body>
      <SharedFilesTable
        contacts={contacts}
        viewerWebId={viewerWebId}
        direction={tab}
        filters={filters}
        chips={chips}
        onObserve={onObserve}
        selectedEntryUri={selectedEntryUri}
        onSelect={onSelect}
      />
    </shared-body>
  );
};

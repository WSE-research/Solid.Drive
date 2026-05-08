/**
 * Body for the SharedView — occupies the main grid slot. Switches
 * between the With-you table and the By-you table based on the active
 * tab passed by the parent. The same {@link SharedFilesTable}
 * implementation backs both tabs; only the catalog read direction
 * changes.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { SharedFilesTable } from './SharedFilesTable';
import type { SharedTabId } from './SharedToolbar';
import type { FilterChipDef } from '@/features/onedrive-layout/components/filters/TypeFilterChips/TypeFilterChips-file/chipCatalog';
import type { SharedFilters } from '@/features/onedrive-layout/hooks/useSharedFilters';

/**
 * Props for {@link SharedBody}.
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
}

/**
 * Renders the active tab's body.
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
      />
    </shared-body>
  );
};

/**
 * Flat table of shared entries (Name / Date Shared / Shared by). Each
 * contact's row block reports the schema.org classes it sees so the
 * toolbar chips reflect the actual catalog.
 *
 * @packageDocumentation
 */

import { useEffect, type FunctionComponent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSubject } from '@ldo/solid-react';
import { SolidProfileShapeType } from '@/.ldo/solidProfile.shapeTypes';
import { useSharedCatalog } from '@/features/file-explorer/hooks/useSharedCatalog';
import { getProfileDisplayName } from '@/shared/utils/getProfileDisplayName';
import { useContactProfile } from '@/shared/hooks/useContactProfile';
import { SHORT_DATE_FORMAT_OPTIONS } from '@/config';
import {
  chipForClassUri,
  chipForFolder,
  chipForPdf,
  type ChipEntry,
  type FilterChipDef,
} from '@/features/onedrive-layout/components/filters/TypeFilterChips/TypeFilterChips-file/chipCatalog';
import {
  formatRowDate,
  isActivationKey,
  parentFolderLabel,
  safeDecodeUriTail,
} from '@/features/onedrive-layout/formatting';
import type { SharedFilters } from '@/features/onedrive-layout/hooks/useSharedFilters';
import type { SharedSelection } from './useSharedSelection';

const DEFAULT_DOCUMENT_CLASS = 'http://schema.org/DigitalDocument';

/**
 * With-you reads each contact's catalog; By-you reads the viewer's.
 *
 * @public
 */
export type SharedTableDirection = 'with-you' | 'by-you';

/**
 * Aggregated report sent by each per-contact row block back to the
 * parent so the toolbar's chip set can be derived from the catalog.
 */
type ObserveReport = {
  classes: ReadonlySet<string>;
  hasFolder: boolean;
  hasPdf: boolean;
};

/** Callback the parent passes in to receive a {@link ObserveReport}. */
type Observe = (key: string, report: ObserveReport) => void;

/** Callback fired when the user picks a row. */
type SelectHandler = (next: SharedSelection) => void;

/**
 * Picks the chip-style icon for an entry, matching what the toolbar
 * would show. Folders fall back to the folder chip; unknown classes
 * fall back to the generic document tile.
 */
function pickEntryVisual(entry: ChipEntry): { Icon: FilterChipDef['Icon'] } {
  if (entry.isFolder) return { Icon: chipForFolder().Icon };
  const pdf = chipForPdf();
  if (pdf.matches(entry)) return { Icon: pdf.Icon };
  return { Icon: chipForClassUri(entry.conformsTo || DEFAULT_DOCUMENT_CLASS).Icon };
}

const formatDate = (modified: string | undefined): string =>
  formatRowDate(modified, SHORT_DATE_FORMAT_OPTIONS, '');

interface RowInteractionProps {
  role?: 'row';
  tabIndex?: 0;
  'aria-selected'?: 'true' | 'false';
  onClick?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
}

/**
 * Click/keyboard wiring for a shared row, or an empty object so
 * PeopleView can reuse this table read-only.
 */
function buildRowInteraction(
  onSelect: SelectHandler | undefined,
  selection: SharedSelection,
  isSelected: boolean,
): RowInteractionProps {
  if (!onSelect) return {};
  const handleSelect = (): void => onSelect(selection);
  return {
    role: 'row',
    tabIndex: 0,
    'aria-selected': isSelected ? 'true' : 'false',
    onClick: handleSelect,
    onKeyDown: (event) => {
      if (!isActivationKey(event.key)) return;
      event.preventDefault();
      handleSelect();
    },
  };
}

/**
 * Renders one row per shared entry for a single contact, applies the
 * entry filter, and reports the schema.org classes it sees back to
 * the parent so the toolbar chips can stay in sync with the catalog.
 */
const ContactSharedRows: FunctionComponent<{
  contactWebId: string;
  viewerWebId: string;
  direction: SharedTableDirection;
  filters: SharedFilters;
  chips: readonly FilterChipDef[];
  onObserve: Observe;
  selectedEntryUri: string | undefined;
  onSelect: SelectHandler | undefined;
}> = ({
  contactWebId,
  viewerWebId,
  direction,
  filters,
  chips,
  onObserve,
  selectedEntryUri,
  onSelect,
}) => {
  const isWithYou = direction === 'with-you';
  const profile = useSubject(SolidProfileShapeType, contactWebId);
  const { displayName } = useContactProfile(contactWebId);
  const { sharedEntries, grantedEntries, catalogAccessible } = useSharedCatalog(
    isWithYou ? contactWebId : viewerWebId,
    isWithYou ? viewerWebId : contactWebId,
  );

  const entries = isWithYou ? sharedEntries : grantedEntries;
  const classesKey = entries
    .map((entry) => entry.conformsTo ?? '')
    .filter((value) => value.length > 0)
    .sort()
    .join('|');
  const pdfChip = chipForPdf();
  const hasPdf = entries.some((entry) =>
    pdfChip.matches({ mediaType: entry.mediaType, name: entry.uri }),
  );
  const reportKey = `${direction}::${contactWebId}`;

  useEffect(() => {
    const classes = new Set<string>();
    for (const entry of entries) {
      if (entry.conformsTo) classes.add(entry.conformsTo);
    }
    onObserve(reportKey, { classes, hasFolder: false, hasPdf });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportKey, classesKey, hasPdf, onObserve]);

  if (!catalogAccessible) return null;
  if (!filters.matchesContact(displayName, contactWebId)) return null;

  const personName = getProfileDisplayName(profile ?? undefined, contactWebId);

  return (
    <>
      {entries.map((entry) => {
        const fileName = safeDecodeUriTail(entry.uri);
        const chipEntry: ChipEntry = {
          mediaType: entry.mediaType,
          conformsTo: entry.conformsTo,
          name: fileName,
          isFolder: false,
        };
        if (!filters.matchesEntry(chipEntry, chips)) return null;
        const { Icon } = pickEntryVisual(chipEntry);
        const displayTitle = entry.title || fileName;
        const selection: SharedSelection = {
          entryUri: entry.uri,
          binaryUri: entry.accessURL || entry.uri,
          title: displayTitle,
          mediaType: entry.mediaType ?? '',
        };
        const interaction = buildRowInteraction(
          onSelect,
          selection,
          selectedEntryUri === entry.uri,
        );
        return (
          <shared-files-row key={`${contactWebId}::${entry.uri}`} {...interaction}>
            <shared-files-cell>
              <span className="odl-shared-row__icon" aria-hidden><Icon /></span>
              <shared-files-name>
                <span className="odl-shared-row__title">{displayTitle}</span>
                <span className="odl-shared-row__parent">{parentFolderLabel(entry.uri)}</span>
              </shared-files-name>
            </shared-files-cell>
            <shared-files-cell>
              <span className="odl-shared-row__date">{formatDate(entry.modified)}</span>
            </shared-files-cell>
            <shared-files-cell>
              <span className="odl-shared-row__sharer">{personName}</span>
            </shared-files-cell>
          </shared-files-row>
        );
      })}
    </>
  );
};

/**
 * Props for {@link SharedFilesTable}. `onSelect` is optional so views
 * that reuse the table read-only (for example PeopleView) can render
 * it without wiring up selection.
 *
 * @public
 */
export interface SharedFilesTableProps {
  contacts: string[];
  viewerWebId: string;
  /** Defaults to 'with-you'. Also picks the third column header. */
  direction?: SharedTableDirection;
  filters: SharedFilters;
  chips: readonly FilterChipDef[];
  onObserve: Observe;
  selectedEntryUri?: string;
  onSelect?: SelectHandler;
}

/**
 * Renders the column headers and one row block per contact.
 *
 * @public
 */
export const SharedFilesTable: FunctionComponent<SharedFilesTableProps> = ({
  contacts,
  viewerWebId,
  direction = 'with-you',
  filters,
  chips,
  onObserve,
  selectedEntryUri,
  onSelect,
}) => {
  const [translate] = useTranslation();
  const isWithYou = direction === 'with-you';

  if (contacts.length === 0) {
    const empty = isWithYou
      ? translate('oneDriveLayout.sharedView.withYou.empty', 'No contacts yet.')
      : translate('oneDriveLayout.sharedView.byYou.emptyContacts', 'Add contacts to share files with them.');
    return <p className="odl-shared-empty">{empty}</p>;
  }

  const headers = [
    translate('oneDriveLayout.sharedView.column.name', 'Name'),
    translate('oneDriveLayout.sharedView.column.dateShared', 'Date Shared'),
    isWithYou
      ? translate('oneDriveLayout.sharedView.column.sharedBy', 'Shared by')
      : translate('oneDriveLayout.sharedView.column.sharedWith', 'Shared with'),
  ];

  return (
    <shared-files-table>
      <shared-files-head>
        {headers.map((label) => (
          <shared-files-cell key={label}>
            <span className="odl-shared-head__label">{label}</span>
          </shared-files-cell>
        ))}
      </shared-files-head>
      <shared-files-body>
        {contacts.map((contactWebId) => (
          <ContactSharedRows
            key={`${direction}::${contactWebId}`}
            contactWebId={contactWebId}
            viewerWebId={viewerWebId}
            direction={direction}
            filters={filters}
            chips={chips}
            onObserve={onObserve}
            selectedEntryUri={selectedEntryUri}
            onSelect={onSelect}
          />
        ))}
      </shared-files-body>
    </shared-files-table>
  );
};

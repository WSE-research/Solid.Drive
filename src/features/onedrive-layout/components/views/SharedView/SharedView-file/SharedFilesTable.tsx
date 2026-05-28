/**
 * Renders the shared-with-you list as a flat table — one row per shared
 * entry, columns Name / Date Shared / Shared by — to match the OneDrive
 * reference layout.
 *
 * Each per-contact row block also reports the schema.org classes it
 * observed back up to the parent so the chip toolbar can derive its
 * chip set from the actual catalog data.
 *
 * @packageDocumentation
 */

import { useEffect, type FunctionComponent } from 'react';
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
  parentFolderLabel,
  safeDecodeUriTail,
} from '@/features/onedrive-layout/formatting';
import type { SharedFilters } from '@/features/onedrive-layout/hooks/useSharedFilters';

/**
 * Direction of the catalog read: With-you reads each contact's
 * `.shared-<owner>.ttl`; By-you reads the owner's
 * `.shared-<contact>.ttl`. The chip set + filter state are reused
 * across both directions.
 *
 * @public
 */
export type SharedTableDirection = 'with-you' | 'by-you';

/**
 * Picks a chip-style icon for an entry — uses the chip that would
 * match it in the toolbar, falling back to the folder chip when the
 * entry is a folder and to the generic Word/Document tile otherwise.
 *
 * @internal
 */
function pickEntryVisual(entry: ChipEntry): { Icon: FilterChipDef['Icon'] } {
  if (entry.isFolder) {
    return { Icon: chipForFolder().Icon };
  }
  // PDFs win over the generic schema.org class because users recognize
  // the red PDF tile far better than a "DigitalDocument" label.
  const pdf = chipForPdf();
  if (pdf.matches(entry)) {
    return { Icon: pdf.Icon };
  }
  if (entry.conformsTo) {
    return { Icon: chipForClassUri(entry.conformsTo).Icon };
  }
  return { Icon: chipForClassUri('http://schema.org/DigitalDocument').Icon };
}

const formatDate = (modified: string | undefined): string =>
  formatRowDate(modified, SHORT_DATE_FORMAT_OPTIONS, '');

/**
 * Single contact's row emitter. Reads the shared catalog for one
 * contact, applies the entry filter, renders one row per entry, and
 * reports the observed schema.org classes upward.
 *
 * @internal
 */
const ContactSharedRows: FunctionComponent<{
  contactWebId: string;
  viewerWebId: string;
  direction: SharedTableDirection;
  filters: SharedFilters;
  chips: readonly FilterChipDef[];
  onObserve: (
    key: string,
    report: { classes: ReadonlySet<string>; hasFolder: boolean; hasPdf: boolean },
  ) => void;
}> = ({ contactWebId, viewerWebId, direction, filters, chips, onObserve }) => {
  // With-you reads the contact's `.shared-<viewer>.ttl` (catalogHost =
  // contact). By-you reads the viewer's `.shared-<contact>.ttl`
  // (catalogHost = viewer). The hook is symmetric in its two arguments
  // — we just pick which person hosts the catalog and which person it
  // targets.
  const catalogHost = direction === 'with-you' ? contactWebId : viewerWebId;
  const catalogTarget = direction === 'with-you' ? viewerWebId : contactWebId;

  const profile = useSubject(SolidProfileShapeType, contactWebId);
  const { displayName } = useContactProfile(contactWebId);
  const { sharedEntries, grantedEntries, catalogAccessible } = useSharedCatalog(
    catalogHost,
    catalogTarget,
  );

  const entries = direction === 'with-you' ? sharedEntries : grantedEntries;

  // Report the observed schema.org classes (plus PDF presence) upward
  // so the toolbar's chip set is derived from real catalog data.
  const classesKey = entries
    .map((entry) => entry.conformsTo ?? '')
    .filter((value) => value.length > 0)
    .sort()
    .join('|');

  // Whether at least one entry is recognised as a PDF — drives the
  // synthetic PDF chip in the toolbar.
  const hasPdf = entries.some((entry) => {
    const mediaType = entry.mediaType?.toLowerCase() ?? '';
    if (mediaType === 'application/pdf') return true;
    return entry.uri.toLowerCase().endsWith('.pdf');
  });

  // The reporter map is keyed per contact AND direction so a chip
  // observed in one tab does not leak into the other.
  const reportKey = `${direction}::${contactWebId}`;

  useEffect(() => {
    const classes = new Set<string>();
    for (const entry of entries) {
      if (entry.conformsTo) classes.add(entry.conformsTo);
    }
    onObserve(reportKey, { classes, hasFolder: false, hasPdf });
    // classesKey/hasPdf encode the observation membership; depending on
    // `entries` directly would re-run on every reference change.
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
        return (
          <shared-files-row key={`${contactWebId}::${entry.uri}`}>
            <shared-files-cell>
              <span className="odl-shared-row__icon" aria-hidden>
                <Icon />
              </span>
              <shared-files-name>
                <span className="odl-shared-row__title">
                  {entry.title || fileName}
                </span>
                <span className="odl-shared-row__parent">
                  {parentFolderLabel(entry.uri)}
                </span>
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
 * Props for {@link SharedFilesTable}.
 *
 * @public
 */
export interface SharedFilesTableProps {
  contacts: string[];
  viewerWebId: string;
  /** With-you (default) or By-you. Controls catalog read direction
   * AND the third column header. */
  direction?: SharedTableDirection;
  filters: SharedFilters;
  chips: readonly FilterChipDef[];
  onObserve: (
    key: string,
    report: { classes: ReadonlySet<string>; hasFolder: boolean; hasPdf: boolean },
  ) => void;
}

/**
 * Renders the column headers and one {@link ContactSharedRows} per
 * contact.
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
}) => {
  const [translate] = useTranslation();

  if (contacts.length === 0) {
    return (
      <p className="odl-shared-empty">
        {direction === 'with-you'
          ? translate('oneDriveLayout.sharedView.withYou.empty', 'No contacts yet.')
          : translate(
              'oneDriveLayout.sharedView.byYou.emptyContacts',
              'Add contacts to share files with them.',
            )}
      </p>
    );
  }

  const personColumnLabel =
    direction === 'with-you'
      ? translate('oneDriveLayout.sharedView.column.sharedBy', 'Shared by')
      : translate('oneDriveLayout.sharedView.column.sharedWith', 'Shared with');

  return (
    <shared-files-table>
      <shared-files-head>
        <shared-files-cell>
          <span className="odl-shared-head__label">
            {translate('oneDriveLayout.sharedView.column.name', 'Name')}
          </span>
        </shared-files-cell>
        <shared-files-cell>
          <span className="odl-shared-head__label">
            {translate('oneDriveLayout.sharedView.column.dateShared', 'Date Shared')}
          </span>
        </shared-files-cell>
        <shared-files-cell>
          <span className="odl-shared-head__label">{personColumnLabel}</span>
        </shared-files-cell>
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
          />
        ))}
      </shared-files-body>
    </shared-files-table>
  );
};

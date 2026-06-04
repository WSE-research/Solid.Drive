/**
 * Renders the resources one specific contact shares with the viewer.
 * Extracted from {@link SharedWithMeSection} so other surfaces (the
 * OneDrive Shared and People views) can render the same list.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useSubject } from '@ldo/solid-react';
import { useTranslation } from 'react-i18next';
import { SolidProfileShapeType } from '@/.ldo/solidProfile.shapeTypes';
import { FileCard } from '@/features/file-explorer/components/FileCard';
import { ContactCatalogBrowser } from '@/features/file-explorer/components/ContactCatalogBrowser';
import { toContainerUri } from '@/infrastructure/solid/sharedCatalog';
import { useSharedCatalog } from '@/features/file-explorer/hooks/useSharedCatalog';
import { getProfileDisplayName } from '@/shared/utils/getProfileDisplayName';

/**
 * Decides whether a catalog entry is shown. Every field is optional, so
 * the same predicate filters both full entries and type groups, which
 * carry only a `conformsTo`.
 *
 * @public
 */
export type SharedEntryPredicate = (entry: {
  mediaType?: string;
  isFolder?: boolean;
  name?: string;
  conformsTo?: string;
}) => boolean;

/**
 * Props for {@link ContactSharedFiles}.
 *
 * @public
 */
export interface ContactSharedFilesProps {
  /** WebID of the contact whose shares are being read. */
  contactWebId: string;
  /** WebID of the viewer; selects the shared catalog and probes file access. */
  viewerWebId: string;
  /** Limits which shared entries and type groups are shown. Defaults to showing all. */
  entryFilter?: SharedEntryPredicate;
  /** Hides the "From {{name}}" header when a parent already shows the contact's name. */
  hideFromHeading?: boolean;
}

/** Default {@link ContactSharedFilesProps.entryFilter}: keeps every entry. */
const passThrough: SharedEntryPredicate = () => true;

/**
 * Renders one contact's shared files as cards, followed by the
 * browse-and-request folders for anything not yet shared. Returns nothing
 * until the contact's catalog is reachable.
 *
 * @public
 */
export const ContactSharedFiles: FunctionComponent<ContactSharedFilesProps> = ({
  contactWebId,
  viewerWebId,
  entryFilter = passThrough,
  hideFromHeading = false,
}) => {
  const [translate] = useTranslation();
  const profile = useSubject(SolidProfileShapeType, contactWebId);

  const { sharedEntries, typeGroups, resolvedCatalogUri, catalogAccessible } =
    useSharedCatalog(contactWebId, viewerWebId);

  if (!catalogAccessible) return null;

  const displayName = getProfileDisplayName(profile ?? undefined, contactWebId);
  const catalogUriOrFallback = resolvedCatalogUri ?? '';
  const filteredEntries = sharedEntries.filter(entryFilter);
  const filteredTypeGroups = [...typeGroups.entries()].filter(
    ([classUri]) => entryFilter({ conformsTo: classUri }),
  );

  const hasNoContent =
    filteredEntries.length === 0 && filteredTypeGroups.length === 0;
  const sharedEntriesWithContainerUri = filteredEntries.map((entry) => ({
    ...entry,
    containerUri: toContainerUri(entry.uri),
  }));

  return (
    <>
      {!hideFromHeading && (
        <p className="files-section-label">
          {translate('sharedWithMe.from', { name: displayName })}
        </p>
      )}

      {hasNoContent && (
        <p className="files-section-empty">{translate('sharedWithMe.noFilesYet')}</p>
      )}

      {sharedEntriesWithContainerUri.map((entry) => (
        <FileCard
          key={entry.uri}
          containerUri={entry.containerUri}
          catalogUri={catalogUriOrFallback}
          readOnly
        />
      ))}

      <ContactCatalogBrowser
        contactWebId={contactWebId}
        viewerWebId={viewerWebId}
        entryFilter={entryFilter}
      />
    </>
  );
};

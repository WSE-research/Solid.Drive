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
import { TypeFolder } from '@/features/file-explorer/components/TypeFolder';
import { toContainerUri } from '@/infrastructure/solid/sharedCatalog';
import { useSharedCatalog } from '@/features/file-explorer/hooks/useSharedCatalog';
import { useContactRejections } from '@/shared/hooks/useContactRejections';
import { getProfileDisplayName } from '@/shared/utils/getProfileDisplayName';

/**
 * Predicate applied to each catalog entry.
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
 * @public
 */
export interface ContactSharedFilesProps {
  /** WebID of the contact whose shares we are reading. */
  contactWebId: string;
  /** WebID of the viewer (used for ACL checks). */
  viewerWebId: string;
  entryFilter?: SharedEntryPredicate;
  /** Hides the "From {{name}}" header when a parent already shows the contact's name. */
  hideFromHeading?: boolean;
}

const passThrough: SharedEntryPredicate = () => true;

/**
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
  const { fileRejections, handleClearRejection } = useContactRejections(viewerWebId);

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

      {filteredTypeGroups.length > 0 && (
        <type-folders>
          <p className="type-folders__heading">{translate('sharedWithMe.browseHeading')}</p>
          {filteredTypeGroups.map(([classUri, entries]) => (
            <TypeFolder
              key={classUri}
              classUri={classUri}
              entries={entries}
              contactWebId={contactWebId}
              viewerWebId={viewerWebId}
              rejections={fileRejections}
              onClearRejection={handleClearRejection}
            />
          ))}
        </type-folders>
      )}
    </>
  );
};

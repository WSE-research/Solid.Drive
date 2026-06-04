/**
 * The "request access" section of a contact's catalog: the type folders
 * the viewer can still request, each row carrying its own Pending… /
 * Denied outcome. Shared by {@link ContactSharedFiles} (classic sidebar)
 * and the OneDrive PersonDetailView, so the browse-and-request UI lives
 * in one place. A granted file leaves the list, surfacing in the shared
 * view instead.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { TypeFolder } from '@/features/file-explorer/components/TypeFolder';
import type { SharedEntryPredicate } from '@/features/file-explorer/components/ContactSharedFiles';
import { useSharedCatalog } from '@/features/file-explorer/hooks/useSharedCatalog';
import { useContactRejections } from '@/shared/hooks/useContactRejections';

/**
 * Props for {@link ContactCatalogBrowser}.
 *
 * @public
 */
export interface ContactCatalogBrowserProps {
  /** WebID of the contact whose catalog is being browsed. */
  contactWebId: string;
  /** WebID of the viewer; resolves the shared catalog and reads their request outcomes. */
  viewerWebId: string;
  /** Restricts which type groups are shown. Defaults to showing all. */
  entryFilter?: SharedEntryPredicate;
}

/** Default {@link ContactCatalogBrowserProps.entryFilter}: keeps every type group. */
const passThrough: SharedEntryPredicate = () => true;

/**
 * Lists a contact's browsable type folders, narrowed to the groups that
 * pass {@link ContactCatalogBrowserProps.entryFilter}. Renders nothing
 * when no group survives the filter, so callers can mount it
 * unconditionally.
 *
 * @public
 */
export const ContactCatalogBrowser: FunctionComponent<ContactCatalogBrowserProps> = ({
  contactWebId,
  viewerWebId,
  entryFilter = passThrough,
}) => {
  const [translate] = useTranslation();
  const { typeGroups } = useSharedCatalog(contactWebId, viewerWebId);
  const { fileRejections, fileApprovals, handleClearRejection } = useContactRejections(viewerWebId);

  const visibleGroups = [...typeGroups.entries()].filter(([classUri]) => entryFilter({ conformsTo: classUri }));
  if (visibleGroups.length === 0) return null;

  return (
    <type-folders>
      <p className="type-folders__heading">{translate('sharedWithMe.browseHeading')}</p>
      {visibleGroups.map(([classUri, entries]) => (
        <TypeFolder
          key={classUri}
          classUri={classUri}
          entries={entries}
          contactWebId={contactWebId}
          viewerWebId={viewerWebId}
          rejections={fileRejections}
          approvals={fileApprovals}
          onClearOutcome={handleClearRejection}
        />
      ))}
    </type-folders>
  );
};

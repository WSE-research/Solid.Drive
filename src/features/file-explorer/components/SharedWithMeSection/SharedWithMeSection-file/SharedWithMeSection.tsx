/**
 * Shared files section showing files from contacts.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from "react";
import { useSubject } from "@ldo/solid-react";
import { useTranslation } from "react-i18next";
import { SolidProfileShapeType } from "@/.ldo/solidProfile.shapeTypes";
import { FileCard } from "@/features/file-explorer/components/FileCard";
import { TypeFolder } from "@/features/file-explorer/components/TypeFolder";
import { toContainerUri } from "@/infrastructure/solid/sharedCatalog";
import { useSharedCatalog } from "@/features/file-explorer/hooks/useSharedCatalog";
import { useContactRejections } from "@/shared/hooks/useContactRejections";
import { getProfileDisplayName } from "@/shared/utils/getProfileDisplayName";

/**
 * Component displaying shared files from a single contact.
 *
 * @internal
 */
const ContactSharedFiles: FunctionComponent<{ contactWebId: string; viewerWebId: string }> = ({ contactWebId, viewerWebId }) => {
  const [translate] = useTranslation();
  const profile = useSubject(SolidProfileShapeType, contactWebId);

  const { sharedEntries, typeGroups, resolvedCatalogUri, catalogAccessible, isProfileLoading } =
    useSharedCatalog(contactWebId, viewerWebId);
  const { fileRejections, handleClearRejection } = useContactRejections(viewerWebId);

  const displayName = getProfileDisplayName(profile ?? undefined, contactWebId);

  const catalogUriOrFallback = resolvedCatalogUri ?? "";
  const typeGroupEntries = [...typeGroups.entries()];
  const hasNoContent = sharedEntries.length === 0 && typeGroups.size === 0;
  const hasTypeGroups = typeGroups.size > 0;
  const sharedEntriesWithContainerUri = sharedEntries.map((entry) => ({
    ...entry,
    containerUri: toContainerUri(entry.uri),
  }));

  if (!catalogAccessible) return null;

  return (
    <>
      <p className="files-section-label">{translate("sharedWithMe.from", { name: displayName })}</p>

      {hasNoContent && (
        <p className="files-section-empty">{translate("sharedWithMe.noFilesYet")}</p>
      )}

      {sharedEntriesWithContainerUri.map((entry) => (
        <FileCard
          key={entry.uri}
          containerUri={entry.containerUri}
          catalogUri={catalogUriOrFallback}
          readOnly
        />
      ))}

      {hasTypeGroups && (
        <type-folders>
          <p className="type-folders__heading">{translate("sharedWithMe.browseHeading")}</p>
          {typeGroupEntries.map(([classUri, entries]) => (
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

/**
 * Props for the SharedWithMeSection component.
 */
type SharedWithMeSectionProps = {
  contacts: string[];
  ownerWebId: string;
};

/**
 * Section displaying all files shared by contacts.
 * Reads per-contact shared catalogs and main catalogs with ACL checks.
 *
 * @public
 */
export const SharedWithMeSection: FunctionComponent<SharedWithMeSectionProps> = ({ contacts, ownerWebId }) => {
  const [translate] = useTranslation();
  const otherContacts = contacts.filter((contactWebId) => contactWebId !== ownerWebId);
  if (otherContacts.length === 0) return null;

  return (
    <section>
      <files-section-header>
        <p className="files-section-label">{translate("sharedWithMe.heading")}</p>
      </files-section-header>
      {otherContacts.map((contactWebId) => (
        <ContactSharedFiles key={contactWebId} contactWebId={contactWebId} viewerWebId={ownerWebId} />
      ))}
    </section>
  );
};

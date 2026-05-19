/**
 * Shared files section showing files from contacts.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { ContactSharedFiles } from '@/features/file-explorer/components/ContactSharedFiles';

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
        <ContactSharedFiles
          key={contactWebId}
          contactWebId={contactWebId}
          viewerWebId={ownerWebId}
        />
      ))}
    </section>
  );
};

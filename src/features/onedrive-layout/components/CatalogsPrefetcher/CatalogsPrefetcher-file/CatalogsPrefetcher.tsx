/**
 * Warms the shared-catalog cache at app boot so the Shared and People
 * views render instantly when first opened. Renders nothing. The work
 * happens as a side effect of mounted `useSharedCatalog` hooks, whose
 * dedupe machinery collapses any later duplicate fetch from the real
 * views.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useSharedCatalog } from '@/features/file-explorer/hooks/useSharedCatalog';

/**
 * Mounts `useSharedCatalog` for one contact in both directions so the
 * cache is populated as a side effect. Renders nothing.
 *
 * @internal
 */
const ContactCatalogPrefetch: FunctionComponent<{
  contactWebId: string;
  viewerWebId: string;
}> = ({ contactWebId, viewerWebId }) => {
  // With-you reads the contact's `.shared-<viewer>.ttl`.
  useSharedCatalog(contactWebId, viewerWebId);
  // By-you reads the viewer's `.shared-<contact>.ttl`.
  useSharedCatalog(viewerWebId, contactWebId);
  return null;
};

/**
 * Props for {@link CatalogsPrefetcher}.
 *
 * @public
 */
export interface CatalogsPrefetcherProps {
  /** WebIDs of every contact whose shared catalog should be warmed. */
  contacts: string[];
  /** WebID of the signed-in user, used to resolve the per-viewer catalog file. */
  viewerWebId: string;
}

/**
 * Mounts hidden `useSharedCatalog` consumers for each contact so the
 * Shared and People views render instantly. Returns `null` when no
 * viewer is signed in.
 *
 * @public
 */
export const CatalogsPrefetcher: FunctionComponent<CatalogsPrefetcherProps> = ({
  contacts,
  viewerWebId,
}) => {
  if (!viewerWebId) return null;
  return (
    <>
      {contacts.map((contactWebId) => (
        <ContactCatalogPrefetch
          key={contactWebId}
          contactWebId={contactWebId}
          viewerWebId={viewerWebId}
        />
      ))}
    </>
  );
};

/**
 * Requests view for the OneDrive inspired layout.
 *
 * OneDrive itself has no direct access-requests surface, so this view
 * borrows the rest of the layout's vocabulary: an elevated panel, the
 * shared design tokens, and the same card, action, and empty-state
 * patterns used by SharedView and the file table.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSolidAuth, useSubject } from '@ldo/solid-react';
import { SolidProfileShapeType } from '@/.ldo/solidProfile.shapeTypes';
import { useDriveInitialization } from '@/features/file-explorer/hooks/useDriveInitialization';
import { resolveCatalogUri } from '@/infrastructure/solid/catalog';
import { RequestsList } from './RequestsList';

/**
 * Renders the access-requests view inside the OneDrive view shell.
 *
 * @public
 */
export const RequestsView: FunctionComponent = () => {
  const [translate] = useTranslation();
  const { session } = useSolidAuth();
  const { storageRootUri } = useDriveInitialization();
  const profile = useSubject(SolidProfileShapeType, session.webId);
  const catalogUri = resolveCatalogUri(profile, storageRootUri);

  const ownerWebId = session.webId ?? '';

  // The list reads requests from the user's inbox via
  // `useAccessRequests`, which needs the storage root + catalog URI.
  // Until both are ready, render a quiet placeholder so the view does
  // not flash an empty state during initial bootstrap.
  if (!storageRootUri || !catalogUri) {
    return (
      <onedrive-view data-view-id="requests">
        <p className="odl-view-placeholder">
          {translate('oneDriveLayout.requestsView.connecting', 'Connecting…')}
        </p>
      </onedrive-view>
    );
  }

  return (
    <onedrive-view data-view-id="requests">
      <RequestsList
        ownerWebId={ownerWebId}
        storageRoot={storageRootUri}
        catalogUri={catalogUri}
      />
    </onedrive-view>
  );
};

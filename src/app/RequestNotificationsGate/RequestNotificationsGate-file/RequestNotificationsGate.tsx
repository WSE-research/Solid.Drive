/**
 * Mounts {@link RequestNotificationsProvider} for both shells when the
 * user is signed in and the drive has been initialised. Lives in
 * `app/` because it spans `file-explorer` (drive init) and `profile`
 * (the provider) — wiring that the composition root is the right place
 * to perform.
 *
 * @packageDocumentation
 */

import type { FunctionComponent, ReactNode } from 'react';
import { useSolidAuth, useSubject } from '@ldo/solid-react';
import { SolidProfileShapeType } from '@/.ldo/solidProfile.shapeTypes';
import { useDriveInitialization } from '@/features/file-explorer/hooks/useDriveInitialization';
import { resolveCatalogUri } from '@/infrastructure/solid/catalog';
import { RequestNotificationsProvider } from '@/features/profile/contexts/RequestNotificationsContext';

interface RequestNotificationsGateProps {
  children: ReactNode;
}

/**
 * Wraps children with the request-notifications provider whenever a
 * signed-in user has a known WebID. Storage and catalog URIs may still
 * be loading; the provider tolerates empty values.
 *
 * @public
 */
export const RequestNotificationsGate: FunctionComponent<RequestNotificationsGateProps> = ({ children }) => {
  const { session } = useSolidAuth();
  const profile = useSubject(SolidProfileShapeType, session.webId);
  const { storageRootUri } = useDriveInitialization();
  const catalogUri = resolveCatalogUri(profile, storageRootUri);

  if (!session.isLoggedIn || !session.webId) {
    return <>{children}</>;
  }

  return (
    <RequestNotificationsProvider
      ownerWebId={session.webId}
      storageRoot={storageRootUri ?? ''}
      catalogUri={catalogUri ?? ''}
    >
      {children}
    </RequestNotificationsProvider>
  );
};

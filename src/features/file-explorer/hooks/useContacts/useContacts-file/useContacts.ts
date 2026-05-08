/**
 * Reads the signed-in user's Solid profile and returns the WebID list of
 * agents they `foaf:knows`. Lifted out of `useDriveInitialization` so the
 * drive-bootstrap hook stays focused on storage/navigation concerns.
 *
 * @packageDocumentation
 */

import { useMemo } from 'react';
import { useSolidAuth, useSubject } from '@ldo/solid-react';
import { SolidProfileShapeType } from '@/.ldo/solidProfile.shapeTypes';

/**
 * Returns the list of contact WebIDs from the current session profile.
 * The list is empty until the profile resolves; this is a derived value,
 * so consumers can read it freely without further memoisation.
 *
 * @public
 */
export function useContacts(): string[] {
  const { session } = useSolidAuth();
  const profile = useSubject(SolidProfileShapeType, session.webId);

  return useMemo(
    () =>
      profile?.knows
        ?.toArray()
        .map((contact: { '@id': string }) => contact['@id']) ?? [],
    [profile],
  );
}

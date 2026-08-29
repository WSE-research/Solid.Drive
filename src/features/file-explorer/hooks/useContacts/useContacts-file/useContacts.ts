/**
 * Reads the signed-in user's Solid profile and returns the WebID list of
 * agents they `foaf:knows`. Lifted out of `useDriveInitialization` so the
 * drive-bootstrap hook stays focused on storage/navigation concerns.
 *
 * @packageDocumentation
 */

import { useMemo } from 'react';
import { useResource, useSolidAuth, useSubject } from '@ldo/solid-react';
import { SolidProfileShapeType } from '@/.ldo/solidProfile.shapeTypes';

/**
 * Returns the list of contact WebIDs from the current session profile.
 * The list is empty until the profile resolves. Memoised so repeated
 * renders with an unchanged contact list return the same array reference.
 *
 * Subscribes to the profile document so that a foaf:knows added in another
 * tab, or by another component on this page, is reflected here without a
 * full reload.
 *
 * @public
 */
export function useContacts(): string[] {
  const { session } = useSolidAuth();
  // Force a fetch + subscription on the signed-in profile so a freshly
  // added contact triggers a re-render of every consumer.
  void useResource(session.webId, { subscribe: true });
  const profile = useSubject(SolidProfileShapeType, session.webId);
  const knowsCount = profile?.knows?.toArray().length ?? 0;

  return useMemo(
    () =>
      profile?.knows
        ?.toArray()
        .map((contact: { '@id': string }) => contact['@id']) ?? [],
    // knowsCount is included on purpose: LDO keeps the profile proxy
    // reference stable across updates, so `profile` alone would not
    // recompute this when foaf:knows changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, knowsCount],
  );
}

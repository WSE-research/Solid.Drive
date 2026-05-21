/**
 * Resolves a requester's Solid profile (display name, avatar URL, and
 * loading state) from a WebID.
 *
 * Centralises the LDO-resource + `useSubject` boilerplate that the
 * request-related UI surfaces (bell dropdown, toast, OneDrive card,
 * classic panel row) used to duplicate inline.
 *
 * @packageDocumentation
 */

import { useResource, useSubject } from "@ldo/solid-react";
import { SolidProfileShapeType } from "@/.ldo/solidProfile.shapeTypes";
import type { SolidProfile } from "@/.ldo/solidProfile.typings";
import { isLoadable } from "@/infrastructure/solid/resourceGuards";
import { getProfileDisplayName } from "@/shared/utils";

/**
 * Return value of {@link useRequesterProfile}.
 *
 * @public
 */
export interface UseRequesterProfileResult {
  profile: SolidProfile;
  profileLoading: boolean;
  displayName: string;
  avatarUrl: string | undefined;
}

const getProfileDocUri = (webId: string): string => webId.split("#")[0];

/**
 * Subscribes to a WebID's profile document and exposes the bits the
 * request UI needs.
 *
 * @public
 */
export const useRequesterProfile = (webId: string): UseRequesterProfileResult => {
  const profileResource = useResource(getProfileDocUri(webId));
  const profile = useSubject(SolidProfileShapeType, webId);
  const profileLoading = isLoadable(profileResource) && profileResource.isLoading();
  const displayName = getProfileDisplayName(profile, webId);
  const avatarUrl = profile?.img?.["@id"];
  return { profile, profileLoading, displayName, avatarUrl };
};

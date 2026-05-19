/**
 * @packageDocumentation
 * Resolves a Solid WebID into the display fields needed to render a
 * contact row: name, avatar URL, initial, and loading state. Used by
 * the SharePanel, the OneDrive DetailPanel, and the contacts list so
 * all three render the same name and avatar for a given WebID.
 */

import { useResource, useSubject } from "@ldo/solid-react";
import { SolidProfileShapeType } from "@/.ldo/solidProfile.shapeTypes";
import { getInitial, getProfileDisplayName } from "@/shared/utils";

/**
 * Display-ready fields derived from a contact's Solid profile.
 *
 * @public
 */
export interface ContactProfileView {
  displayName: string;
  avatarUrl: string | undefined;
  initial: string;
  isLoading: boolean;
}

/**
 * Duck-types an LDO connected resource to detect the in-flight state
 * without taking a dependency on `@/infrastructure/solid/resourceGuards`,
 * which `shared/` is not allowed to import.
 *
 * @internal
 */
function isResourceLoading(resource: unknown): boolean {
  if (resource === null || typeof resource !== "object") return false;
  const candidate = resource as { isLoading?: unknown };
  return (
    typeof candidate.isLoading === "function" &&
    (candidate.isLoading as () => boolean)() === true
  );
}

/**
 * Loads a contact's Solid profile and exposes the fields a row needs to
 * render. Splits the WebID fragment so `useResource` always points at
 * the profile document, and runs through the shared display-name helper
 * so every caller produces the same name and initial.
 *
 * @param webId - Contact WebID (with or without `#me` fragment).
 *
 * @public
 */
export function useContactProfile(webId: string): ContactProfileView {
  const profileDocumentUri = webId.split("#")[0];
  const profileResource = useResource(profileDocumentUri);
  const profile = useSubject(SolidProfileShapeType, webId);
  const displayName = getProfileDisplayName(profile ?? undefined, webId);
  return {
    displayName,
    avatarUrl: profile?.img?.["@id"],
    initial: getInitial(displayName),
    isLoading: isResourceLoading(profileResource),
  };
}

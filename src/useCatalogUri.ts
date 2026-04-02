import type { SolidProfile } from "./.ldo/solidProfile.typings";

// Get the catalog URI for the user
// Prefer the profile linked catalog (dcat:catalog) 
// Otherwise fall back to the default location under the storage root
export function resolveCatalogUri(
  profile: SolidProfile | undefined | null,
  storageRoot: string | undefined
): string | undefined {
  if (!storageRoot) return undefined;
  const fromProfile = profile?.catalog?.["@id"];
  if (fromProfile) return fromProfile;
  return `${storageRoot}catalog.ttl`;
}

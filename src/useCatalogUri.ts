import type { SolidProfile } from "./.ldo/solidProfile.typings";

export function resolveCatalogUri(
  profile: SolidProfile | undefined | null,
  storageRoot: string
): string | undefined {
  if (!storageRoot) return undefined;
  const fromProfile = profile?.catalog?.["@id"];
  if (fromProfile) return fromProfile;
  return `${storageRoot}catalog.ttl`;
}

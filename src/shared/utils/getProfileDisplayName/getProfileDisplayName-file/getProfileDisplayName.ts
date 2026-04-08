/**
 * Profile display name utilities.
 *
 * @remarks
 * Extracts human-readable names from Solid profiles with fallbacks.
 *
 * @packageDocumentation
 */

/**
 * Profile-like object with name fields.
 *
 * @public
 */
type ProfileLike = {
  /** FOAF name property. */
  name?: string;
  /** vCard formatted name property. */
  fn?: string;
};

/**
 * Extracts a fallback display name from a WebID.
 *
 * @remarks
 * Removes hash fragments and URL segments, returning a meaningful identifier.
 *
 * @param webId - The WebID to extract from
 * @returns Extracted name segment or the full WebID
 *
 * @public
 */
export function getWebIdFallbackName(webId: string): string {
  return (
    webId
      .replace(/#.*$/, "")
      .split("/")
      .filter(Boolean)
      .find((segment) => segment !== "profile" && segment !== "card" && !segment.startsWith("http")) ?? webId
  );
}

/**
 * Gets the best available display name from a profile.
 *
 * @remarks
 * Checks `name`, then `fn`, then falls back to extracting from the WebID.
 *
 * @param profile - Profile object with name properties
 * @param webId - The user's WebID for fallback
 * @returns Display name string
 *
 * @public
 */
export function getProfileDisplayName(profile: ProfileLike | undefined, webId: string): string {
  return profile?.name ?? profile?.fn ?? getWebIdFallbackName(webId);
}

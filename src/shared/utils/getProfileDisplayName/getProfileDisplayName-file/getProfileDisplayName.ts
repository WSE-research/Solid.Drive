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
 * Path segments that are scaffolding for Solid WebIDs and never useful as a
 * display name. We skip these when scanning a path for a username segment.
 *
 * @internal
 */
const NON_NAME_PATH_SEGMENTS = new Set(["profile", "card", "card.ttl", "users", "people", "u", "p"]);

/**
 * Extracts a fallback display name from a WebID.
 *
 * @remarks
 * Tries (in order) the leftmost subdomain of the host (Pod-per-subdomain
 * pattern, e.g. `alice.solidcommunity.net` → `alice`), then a meaningful
 * path segment (Pod-as-path pattern, e.g. `https://server/users/alice/...`
 * → `alice`), then the host itself, then the raw WebID.
 *
 * @param webId - The WebID to extract from
 * @returns Extracted name segment or the full WebID
 *
 * @public
 */
export function getWebIdFallbackName(webId: string): string {
  let url: URL;
  try {
    url = new URL(webId);
  } catch {
    return webId;
  }

  const hostParts = url.hostname.split(".").filter(Boolean);
  if (hostParts.length >= 3) {
    return hostParts[0];
  }

  const pathSegment = url.pathname
    .split("/")
    .filter(Boolean)
    .find((segment) => !NON_NAME_PATH_SEGMENTS.has(segment));
  if (pathSegment) return pathSegment;

  return url.hostname || webId;
}

/**
 * Gets the best available display name from a profile.
 *
 * @remarks
 * Checks `name`, then `fn`, then falls back to extracting from the WebID.
 * Empty strings are treated as missing so a blank `vcard:fn` still falls
 * through to the WebID-derived name.
 *
 * @param profile - Profile object with name properties
 * @param webId - The user's WebID for fallback
 * @returns Display name string
 *
 * @public
 */
export function getProfileDisplayName(profile: ProfileLike | undefined, webId: string): string {
  return profile?.name?.trim() || profile?.fn?.trim() || getWebIdFallbackName(webId);
}

/**
 * URI validation utility.
 *
 * @packageDocumentation
 */

/**
 * Checks if the URI is absolute (starts with http:// or https://).
 *
 * @param uri - The URI to check
 * @returns True if the URI is absolute
 *
 * @public
 */
export function isAbsoluteUri(uri: string): boolean {
  return uri.startsWith("http://") || uri.startsWith("https://");
}

/**
 * String initial extraction utility.
 *
 * @packageDocumentation
 */

/**
 * Returns the uppercase first character of a display name.
 *
 * @param name - The name to extract the initial from
 * @param fallback - Character to return if name is empty
 * @returns Uppercase first character, or fallback
 *
 * @public
 */
export function getInitial(name: string, fallback = "?"): string {
  return name.slice(0, 1).toUpperCase() || fallback;
}

/**
 * @packageDocumentation
 * Finds a free sibling location for a "keep both" restore: the original
 * spot with an incrementing "(restored)" suffix, the same naming Dropbox
 * uses for a kept duplicate, tried in order until one isn't occupied.
 */

/** Upper bound on candidates tried, so a location that's somehow always occupied fails fast instead of looping forever. */
const MAX_ATTEMPTS = 50;

function candidateAt(originalContainerUri: string, attempt: number): string {
  const trimmed = originalContainerUri.replace(/\/$/, "");
  const suffix = attempt === 1 ? " (restored)" : ` (restored ${attempt})`;
  return `${trimmed}${encodeURIComponent(suffix)}/`;
}

/**
 * Tries `(restored)`, `(restored 2)`, `(restored 3)`, and so on against
 * `isOccupied` until one comes back free, and returns that container URI.
 *
 * @throws If none of the first {@link MAX_ATTEMPTS} candidates are free.
 *
 * @public
 */
export async function resolveKeepBothLocation(
  originalContainerUri: string,
  isOccupied: (candidateContainerUri: string) => Promise<boolean>,
): Promise<string> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const candidate = candidateAt(originalContainerUri, attempt);
    if (!(await isOccupied(candidate))) return candidate;
  }
  throw new Error(`Could not find a free "keep both" location under ${originalContainerUri}`);
}

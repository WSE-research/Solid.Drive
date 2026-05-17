/**
 * Writes text to the system clipboard via the async Clipboard API.
 * Returns true on success and false when the API is unavailable
 * (e.g. insecure context) or rejects (e.g. user-denied permission).
 *
 * @public
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

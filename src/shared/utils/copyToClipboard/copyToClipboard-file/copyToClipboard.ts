/**
 * Writes `text` to the system clipboard. Returns true on success and
 * false when the API is unavailable, for example in an insecure
 * context, or when the write rejects, for example after a user-denied
 * permission prompt.
 *
 * `write` defaults to `navigator.clipboard.writeText` so production
 * callers don't need to pass anything; tests and Node environments can
 * inject a stub instead of monkey-patching `navigator`.
 *
 * @public
 */
export type ClipboardWriter = (text: string) => Promise<void>;

/** Resolves the default clipboard writer at call time so tests can
 *  install navigator.clipboard before invoking. */
function resolveDefaultWriter(): ClipboardWriter | null {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return null;
  return (text: string) => navigator.clipboard.writeText(text);
}

export async function copyToClipboard(
  text: string,
  write?: ClipboardWriter | null,
): Promise<boolean> {
  const writer = write === undefined ? resolveDefaultWriter() : write;
  if (!writer) return false;
  try {
    await writer(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Byte formatting utility.
 *
 * @packageDocumentation
 */

/**
 * Formats a byte count string into a readable size (B, KB, or MB).
 *
 * @param bytes - Byte count as string, or undefined
 * @returns Human-readable size string, or empty string for zero/undefined
 *
 * @public
 */
export function formatBytes(bytes: string | undefined): string {
  const byteCount = parseInt(bytes ?? "0", 10);
  if (!byteCount) return "";
  if (byteCount < 1024) return `${byteCount} B`;
  if (byteCount < 1024 * 1024) return `${(byteCount / 1024).toFixed(1)} KB`;
  return `${(byteCount / (1024 * 1024)).toFixed(1)} MB`;
}

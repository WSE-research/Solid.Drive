/**
 * Fetches a Solid resource via the supplied session bound fetch and
 * triggers a browser download with the given filename. Returns
 * `{ ok: true }` on success or `{ ok: false; reason }` when the fetch
 * fails or the response is non-2xx. The caller is expected to surface
 * `reason` to the user.
 *
 * @packageDocumentation
 */

import type { FetchFn } from "@/types/solid";

export type DownloadResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Download a Solid resource as a browser file save. See file documentation.
 *
 * @public
 */
export async function downloadResource(
  uri: string,
  fileName: string,
  fetchFn: FetchFn,
): Promise<DownloadResult> {
  try {
    const response = await fetchFn(uri);
    if (!response.ok) {
      return { ok: false, reason: `${response.status} ${response.statusText}` };
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(blobUrl);
    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason };
  }
}

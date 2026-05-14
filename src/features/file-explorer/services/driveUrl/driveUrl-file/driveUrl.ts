/**
 * @packageDocumentation
 * Encodes/decodes Solid drive folder URIs into URL search params for deep links.
 */

import type { SolidContainerUri } from "@ldo/connected-solid";
import type { Breadcrumb } from "@/features/file-explorer/hooks/useNavigation";

/** Search param storing the current Solid container URI (deep links, history). */
export const DRIVE_FOLDER_SEARCH_PARAM = "folder";

/** Ensures a container URI ends with a single trailing slash */
export function normalizeContainerUri(uri: string): string {
  const trimmed = uri.trim();
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

/**
 * Whether `candidate` resolves to `storageRoot` or a descendant container thereof.
 */
export function isContainerUnderStorage(candidate: string, storageRoot: string): boolean {
  const root = normalizeContainerUri(storageRoot);
  const c = normalizeContainerUri(candidate);
  return c === root || c.startsWith(root);
}

/**
 * Decodes raw search param content into a container URI string, if valid.
 */
export function decodeDriveFolderSearchParam(raw: string | null): SolidContainerUri | undefined {
  if (raw == null || !raw.trim()) return undefined;
  const decoded =
    /^https?:\/\//i.test(raw.trim()) ? raw.trim() : decodeURIComponent(raw.trim());
  if (!decoded || !decoded.startsWith("http")) return undefined;
  try {
    // Constructed only to validate the URL shape; the value is discarded.
    new URL(decoded);
  } catch {
    return undefined;
  }
  return decoded as SolidContainerUri;
}

/**
 * Builds breadcrumbs from storage root through `folderUri` using path segments.
 */
export function buildDriveBreadcrumbs(
  folderUri: string,
  storageRoot: string,
  storageLabel: string
): Breadcrumb[] {
  const root = normalizeContainerUri(storageRoot);
  const folder = normalizeContainerUri(folderUri);

  if (!folder.startsWith(root)) {
    return [{ label: storageLabel, uri: root as SolidContainerUri }];
  }

  const crumbs: Breadcrumb[] = [{ label: storageLabel, uri: root as SolidContainerUri }];
  const remainder = folder.slice(root.length);
  const segments = remainder.replace(/^\//, "").split("/").filter(Boolean);

  const rootNoTrail = root.replace(/\/$/, "");
  for (let i = 0; i < segments.length; i += 1) {
    const label = decodeURIComponent(segments[i]);
    const pathAcc =
      `${rootNoTrail}${segments.slice(0, i + 1).map((s) => `/${s}`).join("")}` + "/";
    crumbs.push({
      label,
      uri: pathAcc as SolidContainerUri,
    });
  }

  return crumbs;
}

/**
 * Serialized `folder` search value (full URLs need explicit encoding).
 */
export function encodeDriveFolderSearchValue(uri: string): string {
  return encodeURIComponent(uri);
}

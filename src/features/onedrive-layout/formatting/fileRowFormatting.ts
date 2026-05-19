/**
 * Pure formatting + URI helpers shared by every row component in the
 * My Files panel. Lifted out of MyFilesTable / MyFilesSearchTable so
 * the two tables stay in lockstep when, for example, the date format or
 * the size unit changes.
 *
 * @packageDocumentation
 */

import { formatBytes } from '@/shared/utils/formatBytes';
import { DEFAULT_LOCALE, DATE_FORMAT_OPTIONS, INDEX_FILE } from '@/config';

type DateFormatOptions = Intl.DateTimeFormatOptions;

/**
 * Display string for an empty / unknown cell. Centralised so every
 * column renders the same placeholder when its data isn't available.
 */
export const EMPTY_CELL = '—';

/**
 * Keyboard keys that activate a non-button row: Enter and Space.
 * Kept as a tuple so consumers can pattern-match in switch statements.
 */
const ACTIVATION_KEYS: readonly string[] = ['Enter', ' '];

/**
 * Returns true when the given key event should activate a `role="row"`
 * element — i.e. when it's Enter or Space. Pulls the magic-string list
 * into one place so the row components don't drift.
 *
 * @public
 */
export const isActivationKey = (key: string): boolean =>
  ACTIVATION_KEYS.includes(key);

/**
 * Returns the URL-decoded last segment of a URI. The trailing slash
 * on container URIs is stripped first so a folder URI like
 * `https://pod/app/docs/` yields `"docs"` rather than `""`.
 *
 * @public
 */
export const decodeUriTail = (uri: string): string => {
  // String.prototype.split always returns a non-empty array, so .pop()
  // is non-undefined here.
  const segments = uri.replace(/\/$/, '').split('/');
  return decodeURIComponent(segments[segments.length - 1]);
};

/**
 * Catalog entries point at `…/index.ttl` inside their container. The
 * file table keys rows by container URI, so this helper converts a
 * catalog URI to its parent container URI. The transform is idempotent
 * and passes through URIs that don't end in the index filename.
 *
 * @public
 */
export const containerUriFromCatalogUri = (uri: string): string =>
  uri.endsWith(INDEX_FILE) ? uri.slice(0, -INDEX_FILE.length) : uri;

/**
 * Decode-safe variant of {@link decodeUriTail}: returns the raw tail
 * when `decodeURIComponent` throws on a malformed sequence instead of
 * letting it bubble. Used by Recent and Shared tables where the URI
 * comes from another pod and we can't assume valid encoding.
 *
 * @public
 */
export const safeDecodeUriTail = (uri: string): string => {
  const trimmed = uri.endsWith('/') ? uri.slice(0, -1) : uri;
  const segments = trimmed.split('/');
  const tail = segments[segments.length - 1];
  try {
    return decodeURIComponent(tail);
  } catch {
    return tail;
  }
};

/**
 * Returns the parent-folder leaf used by the filename-and-parent
 * sub-caption pattern. Returns an empty string when no parent segment
 * exists.
 *
 * @public
 */
export const parentFolderLabel = (uri: string): string => {
  const trimmed = uri.endsWith('/') ? uri.slice(0, -1) : uri;
  const segments = trimmed.split('/');
  segments.pop();
  const parent = segments.pop();
  if (!parent) return '';
  try {
    return decodeURIComponent(parent);
  } catch {
    return parent;
  }
};

/**
 * Formats an ISO date for a column. Returns `fallback` (defaults to the
 * {@link EMPTY_CELL} placeholder) when the input is missing or invalid.
 * Centralised so every table renders dates in the same locale and
 * format set.
 *
 * @public
 */
export const formatRowDate = (
  iso: string | undefined,
  options: DateFormatOptions = DATE_FORMAT_OPTIONS,
  fallback: string = EMPTY_CELL,
): string => {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString(DEFAULT_LOCALE, options);
};

/**
 * Modified-column date formatter for My Files rows. Thin wrapper around
 * {@link formatRowDate} kept for compatibility with callers that already
 * know it by name.
 *
 * @public
 */
export const formatModifiedDate = (modified: string | undefined): string =>
  formatRowDate(modified);

/**
 * Formats a catalog `byteSize` for the File size column. Zero-byte
 * files are still shown as zero rather than {@link EMPTY_CELL}; only
 * undefined byteSizes get the placeholder.
 *
 * @public
 */
export const formatCatalogSize = (byteSize: number | undefined): string =>
  byteSize !== undefined ? formatBytes(byteSize.toString()) : EMPTY_CELL;

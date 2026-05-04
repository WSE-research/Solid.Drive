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

/**
 * Display string for an empty / unknown cell. Centralised so every
 * column renders the same placeholder when its data isn't available.
 */
export const EMPTY_CELL = '—';

/**
 * Keyboard keys that should "activate" a non-button row (Enter / Space).
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
 * Returns the human-readable last segment of a URI, URL-decoded. The
 * trailing slash on container URIs is stripped first so a folder URI
 * like `https://pod/app/docs/` yields `"docs"` rather than `""`.
 *
 * @public
 */
export const decodeUriTail = (uri: string): string =>
  decodeURIComponent(uri.replace(/\/$/, '').split('/').pop() ?? '');

/**
 * Catalog entries point at `…/index.ttl` inside their container. The
 * file table keys rows by container URI, so this helper converts a
 * catalog URI to its parent container URI (idempotent — passes through
 * URIs that don't end in the index filename).
 *
 * @public
 */
export const containerUriFromCatalogUri = (uri: string): string =>
  uri.endsWith(INDEX_FILE) ? uri.slice(0, -INDEX_FILE.length) : uri;

/**
 * Formats a catalog `modified` ISO date for the Modified column. Empty
 * or missing values render as the {@link EMPTY_CELL} placeholder.
 *
 * @public
 */
export const formatModifiedDate = (modified: string | undefined): string =>
  modified
    ? new Date(modified).toLocaleDateString(DEFAULT_LOCALE, DATE_FORMAT_OPTIONS)
    : EMPTY_CELL;

/**
 * Formats a catalog `byteSize` for the File size column. Zero-byte
 * files are still shown as zero (rather than {@link EMPTY_CELL}); only
 * undefined byteSizes get the placeholder.
 *
 * @public
 */
export const formatCatalogSize = (byteSize: number | undefined): string =>
  byteSize !== undefined ? formatBytes(byteSize.toString()) : EMPTY_CELL;

/**
 * Pure helper that sorts the catalog/folder entries fed into MyFilesTable.
 *
 * Folders always come before files. Within each group, entries are sorted
 * by the active key, then reversed when the direction is desc.
 *
 * The `sharing` key is a no-op for now: a row's sharing kind requires an
 * async WAC lookup (see useSharingLabel), so at table-build time we don't
 * know it yet. The Sharing column still reflects the live value via
 * useSharingLabel; this helper just preserves input order in that case.
 *
 * Bare folders carry no catalogEntry, so for `modified`, `size`, and
 * `sharing` they are treated as missing values and sorted to the end
 * of their group.
 *
 * @packageDocumentation
 */

import type { CatalogEntry } from '@/types';
import type { SortState } from '@/features/onedrive-layout/hooks/useMyFilesSort';

export interface SortableEntry {
  kind: 'folder' | 'file';
  uri: string;
  displayName: string;
  catalogEntry: CatalogEntry | undefined;
}

const compareStrings = (left: string, right: string): number =>
  left.localeCompare(right, undefined, { sensitivity: 'base' });

const compareWithMissingLast = (
  left: number | undefined,
  right: number | undefined,
): number => {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return left - right;
};

const modifiedTime = (entry: SortableEntry): number | undefined => {
  const modified = entry.catalogEntry?.modified;
  return modified ? new Date(modified).getTime() : undefined;
};

const byteSize = (entry: SortableEntry): number | undefined =>
  entry.catalogEntry?.byteSize;

const compareEntries = (
  left: SortableEntry,
  right: SortableEntry,
  state: SortState,
): number => {
  if (state.key === 'name') {
    return compareStrings(left.displayName, right.displayName);
  }
  if (state.key === 'modified') {
    return compareWithMissingLast(modifiedTime(left), modifiedTime(right));
  }
  if (state.key === 'size') {
    return compareWithMissingLast(byteSize(left), byteSize(right));
  }
  // 'sharing' — kind is async; cannot resolve here, so leave input order.
  return 0;
};

export function sortEntries(
  entries: readonly SortableEntry[],
  state: SortState,
): SortableEntry[] {
  const compare = (left: SortableEntry, right: SortableEntry): number =>
    compareEntries(left, right, state);
  const folders = [...entries.filter((entry) => entry.kind === 'folder')].sort(compare);
  const files = [...entries.filter((entry) => entry.kind === 'file')].sort(compare);
  if (state.direction === 'desc') {
    return [...folders.reverse(), ...files.reverse()];
  }
  return [...folders, ...files];
}

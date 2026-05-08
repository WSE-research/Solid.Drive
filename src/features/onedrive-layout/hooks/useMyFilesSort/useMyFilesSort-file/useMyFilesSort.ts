/**
 * Tracks the current sort order for the My Files table. Persists for the
 * browser session in sessionStorage so a reload within the tab restores
 * the user's choice; a new tab starts on the default.
 *
 * @packageDocumentation
 */

import { useCallback, useState } from 'react';

export type SortKey = 'name' | 'modified' | 'size' | 'sharing';
export type SortDirection = 'asc' | 'desc';
export interface SortState { key: SortKey; direction: SortDirection; }

const STORAGE_KEY = 'onedrive-layout.myFiles.sort';
const VALID_KEYS: readonly SortKey[] = ['name', 'modified', 'size', 'sharing'];
const DEFAULT: SortState = { key: 'name', direction: 'asc' };

/**
 * Type guard for {@link SortState}. Exported so call sites that receive
 * untyped values (URL params, Radix dropdown callbacks, …) can narrow
 * them with the same single source of truth as the hook itself.
 *
 * @public
 */
export const isSortState = (value: unknown): value is SortState => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    VALID_KEYS.includes(candidate.key as SortKey) &&
    (candidate.direction === 'asc' || candidate.direction === 'desc')
  );
};

function readStored(): SortState {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed: unknown = JSON.parse(raw);
    return isSortState(parsed) ? parsed : DEFAULT;
  } catch {
    // Storage denied (private mode) or stored value isn't valid JSON.
    return DEFAULT;
  }
}

export interface UseMyFilesSort {
  sort: SortState;
  setSort: (next: SortState) => void;
}

export function useMyFilesSort(): UseMyFilesSort {
  const [sort, setSortState] = useState<SortState>(readStored);
  const setSort = useCallback((next: SortState) => {
    if (!isSortState(next)) return;
    setSortState(next);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Quota exceeded or storage denied; in-memory state still updates.
    }
  }, []);
  return { sort, setSort };
}

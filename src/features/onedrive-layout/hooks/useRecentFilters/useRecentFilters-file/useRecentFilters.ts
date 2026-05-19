/**
 * Filter, search, and sort state for the Home / Recent view. Owns chip
 * selection, query input, the chip set derived from catalog observations,
 * and the recency-ordered visible-entries projection.
 *
 * @packageDocumentation
 */

import { useCallback, useMemo, useState } from 'react';
import {
  deriveChipsFromEntries,
  entryMatchesChipSelection,
  type ChipEntry,
  type FilterChipDef,
} from '@/features/onedrive-layout/components/filters/TypeFilterChips/TypeFilterChips-file/chipCatalog';
import type { CatalogEntry } from '@/types';

export interface UseRecentFiltersArgs {
  catalogEntries: readonly CatalogEntry[];
  ownerName: string;
}

export interface UseRecentFiltersReturn {
  chips: readonly FilterChipDef[];
  selectedChips: ReadonlySet<string>;
  query: string;
  visibleEntries: readonly CatalogEntry[];
  setQuery: (next: string) => void;
  toggleChip: (chipId: string) => void;
  resetChips: () => void;
}

/**
 * Returns the chip set, current selection, query, and the
 * already-filtered + sorted entries the table should render.
 *
 * @public
 */
export function useRecentFilters({
  catalogEntries,
  ownerName,
}: UseRecentFiltersArgs): UseRecentFiltersReturn {
  const [selectedChips, setSelectedChips] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [query, setQuery] = useState('');

  const toggleChip = useCallback((chipId: string) => {
    // Single-select to match the SharedView's chip semantics.
    setSelectedChips((current) => {
      if (current.size === 1 && current.has(chipId)) return new Set();
      return new Set([chipId]);
    });
  }, []);

  const resetChips = useCallback(() => setSelectedChips(new Set()), []);

  const chips = useMemo<readonly FilterChipDef[]>(() => {
    const observations: ChipEntry[] = catalogEntries.map((entry) => ({
      conformsTo: entry.conformsTo,
      mediaType: entry.mediaType,
      name: entry.title,
    }));
    return deriveChipsFromEntries(observations);
  }, [catalogEntries]);

  const visibleEntries = useMemo<readonly CatalogEntry[]>(() => {
    const trimmedQuery = query.trim().toLowerCase();
    const matchesQuery = (entry: { title: string }) =>
      trimmedQuery.length === 0 ||
      entry.title.toLowerCase().includes(trimmedQuery) ||
      ownerName.toLowerCase().includes(trimmedQuery);
    const filtered = catalogEntries.filter((entry) => {
      if (!matchesQuery(entry)) return false;
      const chipEntry: ChipEntry = {
        conformsTo: entry.conformsTo,
        mediaType: entry.mediaType,
        name: entry.title,
      };
      return entryMatchesChipSelection(chipEntry, selectedChips, chips);
    });
    return [...filtered].sort((left, right) => {
      const leftMs = left.modified ? Date.parse(left.modified) : 0;
      const rightMs = right.modified ? Date.parse(right.modified) : 0;
      return rightMs - leftMs;
    });
  }, [catalogEntries, query, ownerName, selectedChips, chips]);

  return {
    chips,
    selectedChips,
    query,
    visibleEntries,
    setQuery,
    toggleChip,
    resetChips,
  };
}

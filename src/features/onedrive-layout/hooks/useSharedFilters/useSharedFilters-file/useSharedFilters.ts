/**
 * Owns the filter state shared between the Shared and (eventually) Recent
 * views: a multi-select set of chip ids and a free-text query matched
 * against contact display names / WebIDs.
 *
 * The chip list itself is derived externally (from observed catalog
 * entries — see {@link deriveChipsFromEntries}). The hook only owns the
 * *selected* ids and a person query; the matcher takes the chip list
 * as input so the predicate stays stateless.
 *
 * @packageDocumentation
 */

import { useCallback, useMemo, useState } from 'react';
import {
  entryMatchesChipSelection,
  type ChipEntry,
  type FilterChipDef,
} from '@/features/onedrive-layout/components/filters/TypeFilterChips/TypeFilterChips-file/chipCatalog';

/**
 * Public API of the {@link useSharedFilters} hook.
 *
 * @public
 */
export interface SharedFilters {
  /** Currently selected chip ids. Empty = "all". */
  selectedClasses: ReadonlySet<string>;
  /** Toggles a chip id in/out of the selected set. */
  toggleClass: (chipId: string) => void;
  /** Clears the type filter (returns to "all"). */
  resetClasses: () => void;
  /** Free-text query for the person/name filter. */
  personQuery: string;
  /** Updates the person/name query. */
  setPersonQuery: (next: string) => void;
  /** True when at least one filter is active. */
  isActive: boolean;
  /** Returns true when the entry matches the current selection given the chip set. */
  matchesEntry: (entry: ChipEntry, chips: readonly FilterChipDef[]) => boolean;
  /** Returns true when the contact's display name OR WebID matches the query. */
  matchesContact: (displayName: string, webId: string) => boolean;
}

/**
 * Stateful hook owning the chip selection and person query.
 *
 * @public
 */
export function useSharedFilters(): SharedFilters {
  const [selectedClasses, setSelectedClasses] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [personQuery, setPersonQuery] = useState('');

  // Chip selection is single-select: clicking a chip switches the
  // filter to that one chip alone (clearing any other). Re-clicking
  // the active chip clears the selection (back to "All").
  const toggleClass = useCallback((chipId: string) => {
    setSelectedClasses((current) => {
      if (current.size === 1 && current.has(chipId)) return new Set();
      return new Set([chipId]);
    });
  }, []);

  const resetClasses = useCallback(() => {
    setSelectedClasses(new Set<string>());
  }, []);

  const trimmedQuery = personQuery.trim().toLowerCase();
  const isActive = selectedClasses.size > 0 || trimmedQuery.length > 0;

  const matchesEntry = useCallback(
    (entry: ChipEntry, chips: readonly FilterChipDef[]) =>
      entryMatchesChipSelection(entry, selectedClasses, chips),
    [selectedClasses],
  );

  const matchesContact = useCallback(
    (displayName: string, webId: string) => {
      if (trimmedQuery.length === 0) return true;
      return (
        displayName.toLowerCase().includes(trimmedQuery) ||
        webId.toLowerCase().includes(trimmedQuery)
      );
    },
    [trimmedQuery],
  );

  return useMemo(
    () => ({
      selectedClasses,
      toggleClass,
      resetClasses,
      personQuery,
      setPersonQuery,
      isActive,
      matchesEntry,
      matchesContact,
    }),
    [
      selectedClasses,
      toggleClass,
      resetClasses,
      personQuery,
      isActive,
      matchesEntry,
      matchesContact,
    ],
  );
}

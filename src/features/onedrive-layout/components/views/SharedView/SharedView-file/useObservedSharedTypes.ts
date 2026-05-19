/**
 * Aggregates the schema.org classes (plus folder / PDF flags) observed
 * across all per-contact shared catalogs in the SharedView.
 *
 * The reporter pattern: the hook returns a stable `report` callback
 * which the per-contact rows call from a `useEffect`. Each report is
 * keyed by `direction::contactWebId` so observations from With-you
 * and By-you tabs stay separate. `reset` clears the map — the parent
 * calls it on tab switch so chips never carry over from the other tab.
 *
 * @packageDocumentation
 */

import { useCallback, useMemo, useState } from 'react';
import {
  deriveChipsFromEntries,
  type ChipEntry,
  type FilterChipDef,
} from '@/features/onedrive-layout/components/filters/TypeFilterChips/TypeFilterChips-file/chipCatalog';

interface ContactReport {
  classes: ReadonlySet<string>;
  hasFolder: boolean;
  hasPdf: boolean;
}

/**
 * Public API of the hook.
 *
 * @public
 */
export interface ObservedSharedTypes {
  /** Derived chip list (sorted, deduped, with synthetic Folder/PDF). */
  chips: FilterChipDef[];
  /** Stable callback fed to the per-contact reporter components. */
  report: (key: string, report: ContactReport) => void;
  /** Clears every observation. The parent calls this on tab change. */
  reset: () => void;
}

/**
 * Hook implementation.
 *
 * @public
 */
export function useObservedSharedTypes(): ObservedSharedTypes {
  const [perKey, setPerKey] = useState<ReadonlyMap<string, ContactReport>>(
    () => new Map(),
  );

  const report = useCallback((key: string, next: ContactReport) => {
    setPerKey((current) => {
      const existing = current.get(key);
      if (existing && reportsEqual(existing, next)) return current;
      const updated = new Map(current);
      updated.set(key, next);
      return updated;
    });
  }, []);

  const reset = useCallback(() => {
    setPerKey((current) => (current.size === 0 ? current : new Map()));
  }, []);

  const chips = useMemo<FilterChipDef[]>(() => {
    const aggregated: ChipEntry[] = [];
    for (const entry of perKey.values()) {
      if (entry.hasFolder) aggregated.push({ isFolder: true });
      if (entry.hasPdf) aggregated.push({ mediaType: 'application/pdf' });
      for (const classUri of entry.classes) {
        aggregated.push({ conformsTo: classUri });
      }
    }
    return deriveChipsFromEntries(aggregated);
  }, [perKey]);

  return useMemo(() => ({ chips, report, reset }), [chips, report, reset]);
}

/**
 * Equality check tuned for the reporter — two reports are equal when
 * their flags match and their class sets contain the same members.
 *
 * @internal
 */
function reportsEqual(left: ContactReport, right: ContactReport): boolean {
  if (left.hasFolder !== right.hasFolder) return false;
  if (left.hasPdf !== right.hasPdf) return false;
  if (left.classes.size !== right.classes.size) return false;
  for (const value of left.classes) {
    if (!right.classes.has(value)) return false;
  }
  return true;
}

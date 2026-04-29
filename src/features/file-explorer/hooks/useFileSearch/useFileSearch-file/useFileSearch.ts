/**
 * Debounced, case-insensitive, AND-across-terms substring search
 * over catalog entries' title and mediaType.
 *
 * @packageDocumentation
 */

import { useEffect, useMemo, useState } from "react";
import type { CatalogEntry } from "@/types";

const DEBOUNCE_MS = 200;

/**
 * Filters catalog entries by a user-entered query.
 *
 * @remarks
 * Whitespace-splits the query into terms. An entry matches only if every
 * term is a substring of `title` or `mediaType` (case-insensitive).
 * Empty or whitespace-only queries yield an empty result set so callers
 * can distinguish "no search" from "search with zero hits".
 *
 * @param entries - Catalog entries to filter
 * @param query - Raw user input; debounced internally
 * @returns The debounced query actually applied and the matching entries
 *
 * @public
 */
export function useFileSearch(
  entries: CatalogEntry[],
  query: string
): { debouncedQuery: string; results: CatalogEntry[] } {
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  const results = useMemo(() => {
    const terms = debouncedQuery.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];
    return entries.filter((entry) => {
      const haystack = `${entry.title} ${entry.mediaType}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [entries, debouncedQuery]);

  return {
    debouncedQuery: debouncedQuery.trim() === "" ? "" : debouncedQuery,
    results,
  };
}

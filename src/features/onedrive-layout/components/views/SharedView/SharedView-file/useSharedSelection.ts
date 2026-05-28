/**
 * Tracks the currently selected entry in the Shared view. Selecting
 * the same entry toggles the selection off; pressing Escape clears it.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useState } from 'react';

/**
 * The currently selected row, as far as the toolbar and preview dialog
 * care about it. `binaryUri` is the URL that Open and Download fetch;
 * it falls back to `entryUri` when the catalog does not expose a
 * separate access URL.
 *
 * @public
 */
export interface SharedSelection {
  entryUri: string;
  binaryUri: string;
  title: string;
  mediaType: string;
}

export interface UseSharedSelection {
  selected: SharedSelection | null;
  select: (next: SharedSelection) => void;
  clear: () => void;
}

export function useSharedSelection(): UseSharedSelection {
  const [selected, setSelected] = useState<SharedSelection | null>(null);

  const select = useCallback((next: SharedSelection) => {
    setSelected((current) =>
      current?.entryUri === next.entryUri ? null : next,
    );
  }, []);

  const clear = useCallback(() => setSelected(null), []);

  useEffect(() => {
    if (selected === null) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected]);

  return { selected, select, clear };
}

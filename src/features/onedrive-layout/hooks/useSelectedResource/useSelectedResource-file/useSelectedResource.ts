/**
 * Tracks which resource (file or folder) is selected in the OneDrive
 * layout's file list. Selecting the same resource toggles the selection
 * off; pressing Escape clears it.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useState } from 'react';

export type SelectedResource =
  | { kind: 'file'; uri: string; name: string }
  | { kind: 'folder'; uri: string; name: string }
  | null;

export interface UseSelectedResource {
  selected: SelectedResource;
  select: (resource: NonNullable<SelectedResource>) => void;
  clear: () => void;
}

export function useSelectedResource(): UseSelectedResource {
  const [selected, setSelected] = useState<SelectedResource>(null);

  const select = useCallback((resource: NonNullable<SelectedResource>) => {
    setSelected((current) => (current?.uri === resource.uri ? null : resource));
  }, []);

  const clear = useCallback(() => setSelected(null), []);

  // Only listen for Escape while something is selected. This avoids
  // multiple stacked listeners across hook instances (e.g. storybook,
  // nested layouts) firing on a single Escape press.
  useEffect(() => {
    if (selected === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  return { selected, select, clear };
}

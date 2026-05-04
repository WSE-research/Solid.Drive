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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return { selected, select, clear };
}

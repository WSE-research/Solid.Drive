/**
 * Reduces the currently-selected resource plus the catalog lookup map
 * into the data shape the DetailPanel needs. Centralises the catalog
 * lookup, container item count, and metadata URI derivation so the
 * panel itself stays declarative.
 *
 * @packageDocumentation
 */

import { useResource } from '@ldo/solid-react';
import { isSolidContainer } from '@/infrastructure/solid/resourceGuards';
import { INDEX_FILE } from '@/config';
import type { CatalogEntry } from '@/types';
import type { SelectedResource } from '@/features/onedrive-layout/hooks/useSelectedResource';

export type ResourceDetails =
  | {
      kind: 'file';
      uri: string;
      name: string;
      metadataUri: string;
      description: string | undefined;
      mediaType: string | undefined;
      byteSize: number | undefined;
      modified: string | undefined;
      created: string | undefined;
    }
  | {
      kind: 'folder';
      uri: string;
      name: string;
      itemCount: number;
      modified: string | undefined;
    };

export interface UseResourceDetailsArgs {
  selection: SelectedResource;
  catalogByContainer: Map<string, CatalogEntry>;
}

/**
 * @public
 */
export function useResourceDetails({
  selection,
  catalogByContainer,
}: UseResourceDetailsArgs): ResourceDetails | null {
  // Call useResource unconditionally to keep hook order stable across
  // renders; pass an empty string when no folder is selected.
  // `subscribe: true` opens a notifications subscription so the
  // item-count stays in sync when files are added or removed.
  const folderResource = useResource(
    selection?.kind === 'folder' ? selection.uri : '',
    { subscribe: true },
  );

  if (!selection) return null;

  if (selection.kind === 'file') {
    const entry = catalogByContainer.get(selection.uri);
    return {
      kind: 'file',
      uri: selection.uri,
      name: entry?.title ?? selection.name,
      metadataUri: `${selection.uri}${INDEX_FILE}`,
      description: entry?.description,
      mediaType: entry?.mediaType,
      byteSize: entry?.byteSize,
      modified: entry?.modified,
      created: undefined,
    };
  }

  const itemCount =
    folderResource && isSolidContainer(folderResource)
      ? folderResource.children().length
      : 0;
  return {
    kind: 'folder',
    uri: selection.uri,
    name: selection.name,
    itemCount,
    modified: undefined,
  };
}

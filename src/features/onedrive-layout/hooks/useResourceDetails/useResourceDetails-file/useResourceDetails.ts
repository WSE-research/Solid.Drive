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
      conformsTo: string | undefined;
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
  // Call useResource unconditionally to keep hook order stable. Passing
  // `undefined` when no folder is selected is the documented disabled
  // state for `@ldo/solid-react`'s useResource — it skips fetching and
  // returns undefined.
  const folderUri = selection?.kind === 'folder' ? selection.uri : undefined;
  const folderResource = useResource(folderUri);

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
      conformsTo: entry?.conformsTo,
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

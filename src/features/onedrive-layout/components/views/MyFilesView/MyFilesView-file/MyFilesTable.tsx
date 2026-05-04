/**
 * Files table for MyFilesView. Renders one row per folder + one row per
 * file (catalog-managed containers, bare folders, and visible leaf files).
 * The Sharing column is async (per row).
 *
 * @packageDocumentation
 */

import { useMemo } from 'react';
import type { DragEvent, FunctionComponent } from 'react';
import { useResource } from '@ldo/solid-react';
import { isSolidContainer } from '@/infrastructure/solid/resourceGuards';
import { INDEX_FILE } from '@/config';
import type { CatalogEntry } from '@/types';
import type { SolidContainer, SolidLeaf } from '@ldo/connected-solid';
import type { SelectedResource } from '@/features/onedrive-layout/hooks/useSelectedResource';
import type { SortState } from '@/features/onedrive-layout/hooks/useMyFilesSort';
import { SharingCell } from './SharingCell';
import { sortEntries } from './sortEntries';
import type { SortableEntry } from './sortEntries';
import { MyFilesTableHead } from './MyFilesTableHead';
import {
  EMPTY_CELL,
  containerUriFromCatalogUri,
  decodeUriTail,
  formatCatalogSize,
  formatModifiedDate,
  isActivationKey,
} from './fileRowFormatting';

interface MyFilesTableProps {
  folderEntries: SolidContainer[];
  leafEntries: SolidLeaf[];
  catalogEntries: CatalogEntry[];
  catalogContainerUris: Set<string>;
  sort: SortState;
  selectedUri?: string;
  onNavigate: (uri: string, label: string) => void;
  onSelect: (resource: NonNullable<SelectedResource>) => void;
  onFolderDrop?: (
    files: File[],
    targetUri: string,
    dataTransfer: DataTransfer | null,
  ) => void;
  onFolderDragOverChange?: (isOver: boolean) => void;
}

interface FolderRowProps {
  entry: SolidContainer;
  catalogContainerUris: Set<string>;
  catalogEntry: CatalogEntry | undefined;
  selected: boolean;
  onNavigate: (uri: string, label: string) => void;
  onSelect: (resource: NonNullable<SelectedResource>) => void;
  onFolderDrop?: (
    files: File[],
    targetUri: string,
    dataTransfer: DataTransfer | null,
  ) => void;
  onFolderDragOverChange?: (isOver: boolean) => void;
}

const FolderRow: FunctionComponent<FolderRowProps> = ({
  entry,
  catalogContainerUris,
  catalogEntry,
  selected,
  onNavigate,
  onSelect,
  onFolderDrop,
  onFolderDragOverChange,
}) => {
  const resource = useResource(entry.uri);
  const isCatalogContainer = catalogContainerUris.has(entry.uri);

  const hasIndex = useMemo(() => {
    if (!resource || !isSolidContainer(resource)) return false;
    return resource
      .children()
      .some(
        (child) =>
          !isSolidContainer(child) && child.uri === `${entry.uri}${INDEX_FILE}`,
      );
  }, [resource, entry.uri]);

  const isFile = isCatalogContainer || hasIndex;

  if (isFile) {
    const title = catalogEntry?.title ?? decodeUriTail(entry.uri);
    const modified = formatModifiedDate(catalogEntry?.modified);
    const size = formatCatalogSize(catalogEntry?.byteSize);
    const handleSelect = () =>
      onSelect({ kind: 'file', uri: entry.uri, name: title });
    return (
      <div
        role="row"
        tabIndex={0}
        aria-selected={selected}
        className={`odl-files-row odl-files-row--file${selected ? ' odl-files-row--active' : ''}`}
        onClick={handleSelect}
        onKeyDown={(event) => {
          if (isActivationKey(event.key)) {
            event.preventDefault();
            handleSelect();
          }
        }}
      >
        <span role="cell" className="odl-files-cell odl-files-cell--name">
          {title}
        </span>
        <span role="cell" className="odl-files-cell">
          {modified}
        </span>
        <span role="cell" className="odl-files-cell">
          {size}
        </span>
        <span role="cell" className="odl-files-cell">
          <SharingCell uri={entry.uri} />
        </span>
      </div>
    );
  }

  // Bare folder.
  const name = decodeUriTail(entry.uri);
  const itemCount =
    resource && isSolidContainer(resource) ? resource.children().length : 0;
  const handleNavigate = () => onNavigate(entry.uri, name);
  const dropHandlers =
    onFolderDrop && onFolderDragOverChange
      ? {
          onDragEnter: (event: DragEvent<HTMLDivElement>) => {
            if (!event.dataTransfer.types.includes('Files')) return;
            event.preventDefault();
            onFolderDragOverChange(true);
          },
          onDragOver: (event: DragEvent<HTMLDivElement>) => {
            if (!event.dataTransfer.types.includes('Files')) return;
            event.preventDefault();
          },
          onDragLeave: () => onFolderDragOverChange(false),
          onDrop: (event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            event.stopPropagation();
            onFolderDragOverChange(false);
            const files = Array.from(event.dataTransfer.files);
            if (files.length > 0)
              onFolderDrop(files, entry.uri, event.dataTransfer);
          },
        }
      : {};
  return (
    <div
      role="row"
      tabIndex={0}
      aria-selected={selected}
      className={`odl-files-row odl-files-row--folder${selected ? ' odl-files-row--active' : ''}`}
      onClick={handleNavigate}
      onKeyDown={(event) => {
        if (isActivationKey(event.key)) {
          event.preventDefault();
          handleNavigate();
        }
      }}
      {...dropHandlers}
    >
      <span role="cell" className="odl-files-cell odl-files-cell--name">
        {name}
      </span>
      <span role="cell" className="odl-files-cell">
        {EMPTY_CELL}
      </span>
      <span role="cell" className="odl-files-cell">
        {itemCount}
      </span>
      <span role="cell" className="odl-files-cell">
        <SharingCell uri={entry.uri} />
      </span>
    </div>
  );
};

interface LeafRowProps {
  entry: SolidLeaf;
  selected: boolean;
  onSelect: (resource: NonNullable<SelectedResource>) => void;
}

const LeafRow: FunctionComponent<LeafRowProps> = ({ entry, selected, onSelect }) => {
  const name = decodeUriTail(entry.uri);
  const handleSelect = () => onSelect({ kind: 'file', uri: entry.uri, name });
  return (
    <div
      role="row"
      tabIndex={0}
      aria-selected={selected}
      className={`odl-files-row odl-files-row--file${selected ? ' odl-files-row--active' : ''}`}
      onClick={handleSelect}
      onKeyDown={(event) => {
        if (isActivationKey(event.key)) {
          event.preventDefault();
          handleSelect();
        }
      }}
    >
      <span role="cell" className="odl-files-cell odl-files-cell--name">
        {name}
      </span>
      <span role="cell" className="odl-files-cell">
        {EMPTY_CELL}
      </span>
      <span role="cell" className="odl-files-cell">
        {EMPTY_CELL}
      </span>
      <span role="cell" className="odl-files-cell">
        {EMPTY_CELL}
      </span>
    </div>
  );
};

/**
 * Browse-mode table body. Renders sorted folder rows followed by sorted
 * leaf-file rows, with a shared four-column header. Folder rows that
 * back catalog entries are styled and behave as file rows.
 *
 * @public
 */
export const MyFilesTable: FunctionComponent<MyFilesTableProps> = ({
  folderEntries,
  leafEntries,
  catalogEntries,
  catalogContainerUris,
  sort,
  selectedUri,
  onNavigate,
  onSelect,
  onFolderDrop,
  onFolderDragOverChange,
}) => {
  const catalogByContainer = useMemo(() => {
    const map = new Map<string, CatalogEntry>();
    for (const entry of catalogEntries) {
      map.set(containerUriFromCatalogUri(entry.uri), entry);
    }
    return map;
  }, [catalogEntries]);

  // Sort SolidContainer entries. Catalog containers are treated as files
  // (they appear under index.ttl); plain folders are treated as folders.
  // Limitation: bare folders we cannot resolve here have no catalog
  // metadata, so size/modified for them are "missing" — they fall to the
  // end of their group when sorting by those keys. The Sharing column is
  // async so the sort helper currently keeps input order for it.
  const sortedFolderEntries = useMemo(() => {
    const sortable: SortableEntry[] = folderEntries.map((entry) => {
      const catalogEntry = catalogByContainer.get(entry.uri);
      const isCatalogFile = catalogContainerUris.has(entry.uri);
      const displayName =
        isCatalogFile && catalogEntry
          ? catalogEntry.title
          : decodeUriTail(entry.uri);
      return {
        kind: isCatalogFile ? 'file' : 'folder',
        uri: entry.uri,
        displayName,
        catalogEntry,
      };
    });
    const sorted = sortEntries(sortable, sort);
    const byUri = new Map<string, SolidContainer>(
      folderEntries.map((entry) => [entry.uri, entry]),
    );
    return sorted
      .map((item) => byUri.get(item.uri))
      .filter((entry): entry is SolidContainer => entry !== undefined);
  }, [folderEntries, catalogByContainer, catalogContainerUris, sort]);

  // Leaf files are always 'file' kind. We have no catalog metadata for
  // these so only the name sort produces a meaningful order; other keys
  // collapse to a stable input order.
  const sortedLeafEntries = useMemo(() => {
    const sortable: SortableEntry[] = leafEntries.map((entry) => ({
      kind: 'file',
      uri: entry.uri,
      displayName: decodeURIComponent(entry.uri.split('/').pop() ?? ''),
      catalogEntry: undefined,
    }));
    const sorted = sortEntries(sortable, sort);
    const byUri = new Map<string, SolidLeaf>(
      leafEntries.map((entry) => [entry.uri, entry]),
    );
    return sorted
      .map((item) => byUri.get(item.uri))
      .filter((entry): entry is SolidLeaf => entry !== undefined);
  }, [leafEntries, sort]);

  return (
    <div className="odl-files-table" role="table">
      <MyFilesTableHead />
      <div className="odl-files-table__body">
        {sortedFolderEntries.map((entry) => (
          <FolderRow
            key={entry.uri}
            entry={entry}
            catalogContainerUris={catalogContainerUris}
            catalogEntry={catalogByContainer.get(entry.uri)}
            selected={selectedUri === entry.uri}
            onNavigate={onNavigate}
            onSelect={onSelect}
            onFolderDrop={onFolderDrop}
            onFolderDragOverChange={onFolderDragOverChange}
          />
        ))}
        {sortedLeafEntries.map((entry) => (
          <LeafRow
            key={entry.uri}
            entry={entry}
            selected={selectedUri === entry.uri}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
};

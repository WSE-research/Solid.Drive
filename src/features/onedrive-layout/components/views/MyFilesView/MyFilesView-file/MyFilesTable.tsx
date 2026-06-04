/**
 * Files table for MyFilesView. Renders one row per folder and one row
 * per file across catalog-managed containers, bare folders, and visible
 * leaf files. The Sharing column resolves asynchronously per row.
 *
 * @packageDocumentation
 */

import { memo, useMemo } from 'react';
import type { DragEvent, FunctionComponent } from 'react';
import { useResource } from '@ldo/solid-react';
import { useTranslation } from 'react-i18next';
import { isSolidContainer } from '@/infrastructure/solid/resourceGuards';
import { useResourceModified } from '@/features/onedrive-layout/hooks/useResourceModified';
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
  pickFileIcon,
  pickFolderIcon,
} from '@/features/onedrive-layout/formatting';

/**
 * Pixel size of every file/folder row icon. Passed to the SVG as
 * explicit `width`/`height` so the glyph never falls back to its
 * intrinsic size when CSS dimensions don't apply.
 *
 * @internal
 */
const ROW_ICON_PX = 24;

/**
 * Renders the leading file/folder icon used by every row's Name cell.
 * Self-contained branded SVG with no CSS tile background (for example a
 * yellow folder or a blue Word document glyph). Width and height are
 * passed as props so the SVG has explicit attributes regardless of
 * cascading styles.
 *
 * @internal
 */
const RowIcon: FunctionComponent<{
  Icon: ReturnType<typeof pickFileIcon>['Icon'];
}> = ({ Icon }) => (
  <span className="odl-files-row__icon" aria-hidden>
    <Icon width={ROW_ICON_PX} height={ROW_ICON_PX} />
  </span>
);

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
  isCatalogContainer: boolean;
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

interface CatalogFileRowProps {
  uri: string;
  catalogEntry: CatalogEntry | undefined;
  selected: boolean;
  onSelect: (resource: NonNullable<SelectedResource>) => void;
}

/**
 * Renders one row for a catalog-backed file: the URI is a container,
 * but its `index.ttl` carries the metadata we surface as the row title,
 * size, modified date, and sharing state.
 */
const CatalogFileRow = memo<CatalogFileRowProps>(({
  uri,
  catalogEntry,
  selected,
  onSelect,
}) => {
  const title = catalogEntry?.title ?? decodeUriTail(uri);
  const modified = formatModifiedDate(catalogEntry?.modified);
  const size = formatCatalogSize(catalogEntry?.byteSize);
  const fileIcon = pickFileIcon({
    name: title,
    mediaType: catalogEntry?.mediaType,
    conformsTo: catalogEntry?.conformsTo,
  });
  const handleSelect = () => onSelect({ kind: 'file', uri, name: title });
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
        <RowIcon Icon={fileIcon.Icon} />
        <span className="odl-files-row__title">{title}</span>
      </span>
      <span role="cell" className="odl-files-cell">
        {modified}
      </span>
      <span role="cell" className="odl-files-cell">
        {size}
      </span>
      <span role="cell" className="odl-files-cell">
        <SharingCell uri={uri} />
      </span>
    </div>
  );
});
CatalogFileRow.displayName = 'CatalogFileRow';

const FolderRow = memo<FolderRowProps>(({
  entry,
  isCatalogContainer,
  catalogEntry,
  selected,
  onNavigate,
  onSelect,
  onFolderDrop,
  onFolderDragOverChange,
}) => {
  const [translate] = useTranslation();
  // Skip the fetch when the catalog already tells us this URI is a file.
  // Pass undefined to useResource so it does not request the container.
  const resource = useResource(isCatalogContainer ? undefined : entry.uri);
  const folderModified = useResourceModified(
    isCatalogContainer ? undefined : entry.uri,
  );

  const hasIndex = useMemo(() => {
    if (isCatalogContainer) return true;
    if (!resource || !isSolidContainer(resource)) return false;
    return resource
      .children()
      .some(
        (child) =>
          !isSolidContainer(child) && child.uri === `${entry.uri}${INDEX_FILE}`,
      );
  }, [isCatalogContainer, resource, entry.uri]);

  if (isCatalogContainer || hasIndex) {
    return (
      <CatalogFileRow
        uri={entry.uri}
        catalogEntry={catalogEntry}
        selected={selected}
        onSelect={onSelect}
      />
    );
  }

  // Bare folder.
  const name = decodeUriTail(entry.uri);
  const itemCount =
    resource && isSolidContainer(resource) ? resource.children().length : 0;
  const folderIcon = pickFolderIcon();
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
        <RowIcon Icon={folderIcon.Icon} />
        <span className="odl-files-row__title">{name}</span>
      </span>
      <span role="cell" className="odl-files-cell">
        {formatModifiedDate(folderModified)}
      </span>
      <span role="cell" className="odl-files-cell">
        {translate('oneDriveLayout.itemCount', '{{count}} items', {
          count: itemCount,
        })}
      </span>
      <span role="cell" className="odl-files-cell">
        <SharingCell uri={entry.uri} />
      </span>
    </div>
  );
});
FolderRow.displayName = 'FolderRow';

interface LeafRowProps {
  entry: SolidLeaf;
  selected: boolean;
  onSelect: (resource: NonNullable<SelectedResource>) => void;
}

const LeafRow = memo<LeafRowProps>(({ entry, selected, onSelect }) => {
  const name = decodeUriTail(entry.uri);
  const fileIcon = pickFileIcon({ name });
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
        <RowIcon Icon={fileIcon.Icon} />
        <span className="odl-files-row__title">{name}</span>
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
});
LeafRow.displayName = 'LeafRow';

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
  // because they appear under index.ttl; plain folders are treated as
  // folders. Limitation: bare folders we cannot resolve here have no
  // catalog metadata, so their size and modified values are missing and
  // they fall to the end of their group when sorting by those keys. The
  // Sharing column is async so the sort helper currently keeps input
  // order for it.
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
            isCatalogContainer={catalogContainerUris.has(entry.uri)}
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

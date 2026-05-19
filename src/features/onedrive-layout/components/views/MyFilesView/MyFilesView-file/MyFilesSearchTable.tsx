/**
 * Search-mode table for MyFilesView. Renders a flat list of catalog
 * matches across containers, ordered by the `useFileSearch` results.
 *
 * Sort and folder navigation are not applied here — search results are
 * always file rows, in the order the search hook returned.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import type { CatalogEntry } from '@/types';
import type { SelectedResource } from '@/features/onedrive-layout/hooks/useSelectedResource';
import { SharingCell } from './SharingCell';
import { MyFilesTableHead } from './MyFilesTableHead';
import {
  containerUriFromCatalogUri,
  formatCatalogSize,
  formatModifiedDate,
  isActivationKey,
  pickFileIcon,
} from '@/features/onedrive-layout/formatting';

interface MyFilesSearchTableProps {
  query: string;
  results: CatalogEntry[];
  selectedUri?: string;
  onSelect: (resource: NonNullable<SelectedResource>) => void;
}

/**
 * Search-mode table body. Renders a flat list of catalog matches as
 * file rows, with no folders, sort, or navigation. Falls back to a
 * localized empty-state message when the query has no hits.
 *
 * @public
 */
export const MyFilesSearchTable: FunctionComponent<MyFilesSearchTableProps> = ({
  query,
  results,
  selectedUri,
  onSelect,
}) => {
  const [translate] = useTranslation();

  if (results.length === 0) {
    return (
      <div className="odl-search-empty">
        <p>
          {translate(
            'fileExplorer.searchNoResults',
            'No files match "{{query}}"',
            { query },
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="odl-files-table" role="table">
      <MyFilesTableHead />
      <div className="odl-files-table__body">
        {results.map((entry) => {
          const containerUri = containerUriFromCatalogUri(entry.uri);
          const modified = formatModifiedDate(entry.modified);
          const size = formatCatalogSize(entry.byteSize);
          const fileIcon = pickFileIcon({
            name: entry.title,
            mediaType: entry.mediaType,
            conformsTo: entry.conformsTo,
          });
          const selected = selectedUri === containerUri;
          const handleSelect = () =>
            onSelect({ kind: 'file', uri: containerUri, name: entry.title });
          return (
            <div
              key={entry.uri}
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
                <span className="odl-files-row__icon" aria-hidden>
                  <fileIcon.Icon width={24} height={24} />
                </span>
                <span className="odl-files-row__title">{entry.title}</span>
              </span>
              <span role="cell" className="odl-files-cell">
                {modified}
              </span>
              <span role="cell" className="odl-files-cell">
                {size}
              </span>
              <span role="cell" className="odl-files-cell">
                <SharingCell uri={containerUri} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

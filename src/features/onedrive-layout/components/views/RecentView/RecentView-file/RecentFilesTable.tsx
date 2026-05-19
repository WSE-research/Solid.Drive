/**
 * Renders the Home view's "Recent" list as a flat table — one row per
 * catalog entry, columns Name / Opened / Owner — to match the
 * OneDrive reference layout.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import type { CatalogEntry } from '@/types';
import { pickFileIcon } from '@/features/onedrive-layout/formatting';
import {
  formatRowDate,
  parentFolderLabel,
  safeDecodeUriTail,
} from '@/features/onedrive-layout/formatting';

interface RecentRowProps {
  entry: CatalogEntry;
  ownerName: string;
}

const formatOpened = (modified: string | undefined): string =>
  formatRowDate(modified, undefined, '');

const RecentRow: FunctionComponent<RecentRowProps> = ({ entry, ownerName }) => {
  const fileName = safeDecodeUriTail(entry.uri);
  const title = entry.title || fileName;
  const { Icon } = pickFileIcon({
    name: title,
    mediaType: entry.mediaType,
    conformsTo: entry.conformsTo,
  });
  const parent = parentFolderLabel(entry.uri);
  return (
    <recent-files-row data-testid="recent-files-row" data-uri={entry.uri}>
      <recent-files-cell>
        <span className="odl-recent-row__icon" aria-hidden>
          <Icon width={24} height={24} />
        </span>
        <recent-files-name>
          <span className="odl-recent-row__title">{title}</span>
          {parent && (
            <span className="odl-recent-row__parent">{parent}</span>
          )}
        </recent-files-name>
      </recent-files-cell>
      <recent-files-cell>
        <span className="odl-recent-row__date">{formatOpened(entry.modified)}</span>
      </recent-files-cell>
      <recent-files-cell>
        <span className="odl-recent-row__owner">{ownerName}</span>
      </recent-files-cell>
    </recent-files-row>
  );
};

/**
 * Props for {@link RecentFilesTable}.
 *
 * @public
 */
export interface RecentFilesTableProps {
  entries: readonly CatalogEntry[];
  ownerName: string;
}

/**
 * Renders the Recent column headers and one {@link RecentRow} per entry.
 * Empty state surfaces a muted "no recent files" message.
 *
 * @public
 */
export const RecentFilesTable: FunctionComponent<RecentFilesTableProps> = ({
  entries,
  ownerName,
}) => {
  const [translate] = useTranslation();

  if (entries.length === 0) {
    return (
      <p className="odl-recent-empty">
        {translate(
          'oneDriveLayout.recentView.empty',
          'No recent files yet — anything you open will show up here.',
        )}
      </p>
    );
  }

  return (
    <recent-files-table>
      <recent-files-head>
        <recent-files-cell>
          <span className="odl-recent-head__label">
            {translate('oneDriveLayout.recentView.column.name', 'Name')}
          </span>
        </recent-files-cell>
        <recent-files-cell>
          <span className="odl-recent-head__label">
            {translate('oneDriveLayout.recentView.column.opened', 'Opened')}
          </span>
        </recent-files-cell>
        <recent-files-cell>
          <span className="odl-recent-head__label">
            {translate('oneDriveLayout.recentView.column.owner', 'Owner')}
          </span>
        </recent-files-cell>
      </recent-files-head>
      <recent-files-body>
        {entries.map((entry) => (
          <RecentRow key={entry.uri} entry={entry} ownerName={ownerName} />
        ))}
      </recent-files-body>
    </recent-files-table>
  );
};

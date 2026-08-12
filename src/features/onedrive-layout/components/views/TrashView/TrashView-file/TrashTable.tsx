/**
 * @packageDocumentation
 * Renders the Recycle Bin as a flat table with file details,
 * retention information, and restore or permanent-delete actions.
 */

import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { RestoreIcon, PurgeIcon } from '@/features/onedrive-layout/icons';
import {
  EMPTY_CELL,
  decodeUriTail,
  formatCatalogSize,
  formatRowDate,
  pickFileIcon,
} from '@/features/onedrive-layout/formatting';
import type { TrashEntry } from '@/features/file-explorer/hooks/useTrashEntries';
import { formatExpiry } from './formatExpiry';

/**
 * Props for {@link TrashTable}.
 *
 * @public
 */
export interface TrashTableProps {
  // Entries currently available in the Recycle Bin.
  entries: readonly TrashEntry[];
  busyContainerUri?: string;
  onRestore: (item: TrashEntry) => void;
  onPurge: (item: TrashEntry) => void;
}

interface TrashRowProps {
  item: TrashEntry;
  busy: boolean;
  onRestore: (item: TrashEntry) => void;
  onPurge: (item: TrashEntry) => void;
}

const TrashRow: FunctionComponent<TrashRowProps> = ({ item, busy, onRestore, onPurge }) => {
  const [translate] = useTranslation();
  const { entry, tombstone } = item;
  const title = entry.title || decodeUriTail(item.containerUri);
  const originalLocation = tombstone ? decodeUriTail(tombstone.originalContainerUri) : EMPTY_CELL;
  const { Icon } = pickFileIcon({ name: title, mediaType: entry.mediaType, conformsTo: entry.classUri });
  const deleted = formatRowDate(tombstone?.deletedAt);
  const expiry = tombstone ? formatExpiry(tombstone.expiresAt, new Date()) : null;
  const size = formatCatalogSize(entry.byteSize);
  const canRestore = tombstone !== null && !busy;

  const restoreLabel = translate('oneDriveLayout.trashView.action.restore', 'Restore');
  const purgeLabel = translate('oneDriveLayout.trashView.action.purge', 'Delete permanently');
  const handleRestore = () => canRestore && onRestore(item);
  const handlePurge = () => !busy && onPurge(item);

  return (
    <trash-row role="row" data-testid="trash-row" data-uri={item.containerUri}>
      <trash-cell role="cell">
        <span className="odl-trash-row__icon" aria-hidden>
          <Icon width={24} height={24} />
        </span>
        <span className="odl-trash-row__name">
          <span className="odl-trash-row__title">{title}</span>
          <span className="odl-trash-row__location">{originalLocation}</span>
        </span>
      </trash-cell>
      <trash-cell role="cell">{deleted}</trash-cell>
      <trash-cell role="cell">{expiry ? translate(expiry.key, { count: expiry.count }) : EMPTY_CELL}</trash-cell>
      <trash-cell role="cell">{size}</trash-cell>
      <trash-row-actions>
        <button
          type="button"
          className="odl-trash-action"
          disabled={!canRestore}
          aria-label={`${restoreLabel}: ${title}`}
          onClick={handleRestore}
        >
          <RestoreIcon aria-hidden focusable={false} />
          <span>{restoreLabel}</span>
        </button>
        <button
          type="button"
          className="odl-trash-action odl-trash-action--danger"
          disabled={busy}
          aria-label={`${purgeLabel}: ${title}`}
          onClick={handlePurge}
        >
          <PurgeIcon aria-hidden focusable={false} />
          <span>{purgeLabel}</span>
        </button>
      </trash-row-actions>
    </trash-row>
  );
};

/**
 * Renders Recycle Bin entries with restore and permanent-delete actions.
 * Displays an empty state when no trashed items are available.
 *
 * @param props - Recycle Bin entries and row action handlers.
 *
 * @public
 */
export const TrashTable: FunctionComponent<TrashTableProps> = ({ entries, busyContainerUri, onRestore, onPurge }) => {
  const [translate] = useTranslation();

  if (entries.length === 0) {
    return (
      <trash-empty>
        {translate('oneDriveLayout.trashView.empty', 'Recycle bin is empty')}
      </trash-empty>
    );
  }

  return (
    <trash-table role="table">
      <trash-table-head role="row">
        <trash-cell role="columnheader">{translate('oneDriveLayout.trashView.column.name', 'Name')}</trash-cell>
        <trash-cell role="columnheader">{translate('oneDriveLayout.trashView.column.deleted', 'Deleted')}</trash-cell>
        <trash-cell role="columnheader">{translate('oneDriveLayout.trashView.column.expires', 'Expires')}</trash-cell>
        <trash-cell role="columnheader">{translate('oneDriveLayout.trashView.column.size', 'Size')}</trash-cell>
        <trash-cell role="columnheader">{translate('oneDriveLayout.trashView.column.actions', 'Actions')}</trash-cell>
      </trash-table-head>
      <trash-table-body>
        {entries.map((item) => (
          <TrashRow
            key={item.containerUri}
            item={item}
            busy={busyContainerUri === item.containerUri}
            onRestore={onRestore}
            onPurge={onPurge}
          />
        ))}
      </trash-table-body>
    </trash-table>
  );
};

/**
 * @packageDocumentation
 * Recycle bin view for the OneDrive layout. Lists soft-deleted files via
 * {@link useTrashEntries} and owns the restore, purge, and empty-trash
 * confirm prompts and toasts, mirroring {@link useOneDriveActions}'s
 * delete wiring.
 *
 * "Empty recycle bin" purges every entry using the same per-item `purge`
 * the table's own row action already uses, just behind one confirm that
 * covers all of them.
 */

import { useCallback, useState } from 'react';
import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDriveInitialization } from '@/features/file-explorer/hooks/useDriveInitialization';
import { useTrashEntries, type TrashEntry } from '@/features/file-explorer/hooks/useTrashEntries';
import { useNotifications } from '@/shared/contexts/NotificationContext';
import { PurgeIcon } from '@/features/onedrive-layout/icons';
import { TrashTable } from './TrashTable';

/**
 * Renders the Recycle bin view body.
 *
 * @public
 */
export const TrashView: FunctionComponent = () => {
  const [translate] = useTranslation();
  const { storageRootUri } = useDriveInitialization();
  const { entries, loading, error, restore, purge } = useTrashEntries(storageRootUri);
  const { showSuccess, showError, confirm } = useNotifications();
  const [busyContainerUri, setBusyContainerUri] = useState<string | undefined>(undefined);
  const [emptying, setEmptying] = useState(false);

  const handleRestore = useCallback(
    async (item: TrashEntry) => {
      setBusyContainerUri(item.containerUri);
      const result = await restore(item).finally(() => setBusyContainerUri(undefined));

      if (result.ok) {
        showSuccess(
          translate('oneDriveLayout.trashView.toast.restoreSuccess', {
            defaultValue: '"{{name}}" restored',
            name: item.entry.title,
          }),
        );
        if (!result.aclRestored && item.tombstone?.hasAclSnapshot) {
          showError(
            translate(
              'oneDriveLayout.trashView.toast.aclNotRestored',
              'Restored, but sharing permissions could not be restored',
            ),
          );
        }
        return;
      }

      showError(
        result.reason === 'occupied'
          ? translate(
              'oneDriveLayout.trashView.toast.restoreOccupied',
              'A file already exists at the original location',
            )
          : translate('oneDriveLayout.trashView.toast.restoreFail', 'Restore failed'),
      );
    },
    [restore, showSuccess, showError, translate],
  );

  const handlePurge = useCallback(
    async (item: TrashEntry) => {
      const confirmed = await confirm(
        translate('oneDriveLayout.trashView.confirm.purge', {
          defaultValue: 'Permanently delete "{{name}}"? This cannot be undone.',
          name: item.entry.title,
        }),
      );
      if (!confirmed) return;

      setBusyContainerUri(item.containerUri);
      const result = await purge(item).finally(() => setBusyContainerUri(undefined));

      if (result.ok) {
        showSuccess(
          translate('oneDriveLayout.trashView.toast.purgeSuccess', {
            defaultValue: '"{{name}}" permanently deleted',
            name: item.entry.title,
          }),
        );
        return;
      }

      showError(
        `${translate('oneDriveLayout.trashView.toast.purgeFail', 'Delete failed')}: ${result.reason}`,
      );
    },
    [confirm, purge, showSuccess, showError, translate],
  );

  const handleEmptyTrash = useCallback(async () => {
    if (entries.length === 0) return;

    const confirmed = await confirm(
      translate('oneDriveLayout.trashView.confirm.emptyTrash', {
        defaultValue: 'Permanently delete all {{count}} items in the Recycle bin? This cannot be undone.',
        count: entries.length,
      }),
    );
    if (!confirmed) return;

    setEmptying(true);
    const results = [];
    try {
      for (const item of entries) {
        results.push(await purge(item));
      }
    } finally {
      setEmptying(false);
    }

    const failedCount = results.filter((result) => !result.ok).length;
    if (failedCount === 0) {
      showSuccess(translate('oneDriveLayout.trashView.toast.emptyTrashSuccess', 'Recycle bin emptied'));
      return;
    }
    showError(
      translate('oneDriveLayout.trashView.toast.emptyTrashPartialFail', {
        defaultValue: '{{count}} items could not be deleted',
        count: failedCount,
      }),
    );
  }, [entries, purge, confirm, showSuccess, showError, translate]);

  // Show recovered entries even when the trash catalog only parsed partially.
  const body = loading ? (
    <p className="odl-trash-loading">{translate('oneDriveLayout.trashView.loading', 'Loading…')}</p>
  ) : error && entries.length === 0 ? (
    <p className="odl-trash-error">
      {translate('oneDriveLayout.trashView.loadError', 'Could not load the Recycle bin')}
    </p>
  ) : (
    <>
      {error && (
        <p className="odl-trash-warning">
          {translate(
            'oneDriveLayout.trashView.loadPartialError',
            "Some items couldn't be loaded. Refresh to try again.",
          )}
        </p>
      )}
      <TrashTable
        entries={entries}
        busyContainerUri={busyContainerUri}
        onRestore={handleRestore}
        onPurge={handlePurge}
      />
    </>
  );

  return (
    <onedrive-view data-view-id="trash">
      <trash-header>
        <p className="odl-trash-retention-note">
          {translate(
            'oneDriveLayout.trashView.retentionNote',
            'Items are permanently deleted after 30 days.',
          )}
        </p>
        {entries.length > 0 && (
          <button
            type="button"
            className="odl-trash-empty-button"
            disabled={emptying}
            onClick={handleEmptyTrash}
          >
            <PurgeIcon aria-hidden focusable={false} />
            <span>{translate('oneDriveLayout.trashView.action.emptyTrash', 'Empty recycle bin')}</span>
          </button>
        )}
      </trash-header>
      {body}
    </onedrive-view>
  );
};

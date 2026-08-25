/**
 * @packageDocumentation
 * Provides selection-aware actions for the OneDrive layout, including
 * copy link, download, and delete. Handles confirmation prompts and
 * notifications outside the layout component.
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '@/shared/contexts/NotificationContext';
import { useGuardedSoftDelete } from '@/features/file-explorer/hooks/useGuardedSoftDelete';
import { copyToClipboard } from '@/shared/utils/copyToClipboard';
import { deleteResource } from '@/features/file-explorer/services/deleteResource';
import { softDeleteFile } from '@/features/file-explorer/services/softDeleteFile';
import { downloadResource } from '@/features/file-explorer/services/downloadResource';
import { decodeUriTail } from '@/features/onedrive-layout/formatting';
import type { SelectedResource } from '@/features/onedrive-layout/hooks/useSelectedResource';
import type { CatalogEntry, SharedEntry } from '@/types';

export interface UseOneDriveActionsArgs {
  selected: SelectedResource;
  catalogByContainer: Map<string, CatalogEntry>;
  catalogUri: string | null | undefined;
  solidFetch: typeof fetch;
  onAfterDelete: () => void;
  /** Pod storage root. Required for soft delete; folders always hard-delete regardless. */
  storageRootUri?: string | null;
  /** The selection's catalog-row payload, built by the caller (`OneDriveLayout`'s `sharedEntry` memo). */
  entry?: SharedEntry | null;
  /** WebID used as the trash catalog entry's publisher. */
  ownerWebId?: string;
}

export interface UseOneDriveActionsReturn {
  handleCopyLink: () => Promise<void>;
  handleDownload: () => Promise<void>;
  /** Moves a file to the Recycle bin; hard-deletes folders (they aren't catalog-backed, so they can't be tombstoned). */
  handleDelete: () => Promise<void>;
}

/**
 * Returns stable handlers for the selection-aware OneDrive actions.
 *
 * @public
 */
export function useOneDriveActions({
  selected,
  catalogByContainer,
  catalogUri,
  solidFetch,
  onAfterDelete,
  storageRootUri,
  entry,
  ownerWebId,
}: UseOneDriveActionsArgs): UseOneDriveActionsReturn {
  const [translate] = useTranslation();
  const { showSuccess, showError } = useNotifications();
  const { runGuardedDelete } = useGuardedSoftDelete();

  const handleCopyLink = useCallback(async () => {
    if (!selected) return;
    const ok = await copyToClipboard(selected.uri);
    if (ok) {
      showSuccess(
        translate('oneDriveLayout.toast.linkCopied', {
          defaultValue: 'Link to "{{name}}" copied to clipboard',
          name: selected.name,
        }),
      );
    } else {
      showError(
        translate('oneDriveLayout.toast.linkCopyFail', 'Could not copy link'),
      );
    }
  }, [selected, showSuccess, showError, translate]);

  const handleDownload = useCallback(async () => {
    if (!selected || selected.kind !== 'file') return;
    const binaryUri = entry?.binaryUri ?? selected.uri;
    const fileName = decodeUriTail(binaryUri) || selected.name;
    const result = await downloadResource(binaryUri, fileName, solidFetch);
    if (!result.ok) {
      showError(
        `${translate('oneDriveLayout.toast.downloadFail', 'Download failed')}: ${result.reason}`,
      );
    }
  }, [selected, entry, solidFetch, showError, translate]);

  const handleDelete = useCallback(() => {
    if (!selected) return Promise.resolve();

    // Folders always hard-delete because they are not catalog-backed.
    // Files use soft delete when all required owner and catalog data is
    // available, otherwise they fall back to permanent deletion staying dead.
    const canSoftDelete =
      selected.kind === 'file' && !!storageRootUri && !!entry && !!catalogUri && !!ownerWebId;

    return runGuardedDelete({
      resourceUri: selected.uri,
      confirmMessage: canSoftDelete
        ? translate('oneDriveLayout.toast.deleteConfirm', {
            defaultValue: 'Move "{{name}}" to the Recycle bin?',
            name: selected.name,
          })
        : translate('oneDriveLayout.toast.deleteConfirmPermanent', {
            defaultValue: 'Delete "{{name}}"? This cannot be undone.',
            name: selected.name,
          }),
      failedMessage: translate('oneDriveLayout.toast.deleteFail', 'Delete failed'),
      successMessage: canSoftDelete
        ? translate('oneDriveLayout.toast.deleteSuccess', {
            defaultValue: '"{{name}}" moved to the Recycle bin',
            name: selected.name,
          })
        : translate('oneDriveLayout.toast.deleteSuccessPermanent', {
            defaultValue: '"{{name}}" deleted',
            name: selected.name,
          }),
      onSuccess: onAfterDelete,
      run: () =>
        canSoftDelete
          ? softDeleteFile({
              containerUri: selected.uri,
              storageRootUri: storageRootUri!,
              catalogUri: catalogUri!,
              entry: entry!,
              ownerWebId: ownerWebId!,
              fetch: solidFetch,
            })
          : deleteResource({
              containerUri: selected.uri,
              metadataUri: catalogByContainer.get(selected.uri)?.uri,
              catalogUri: catalogUri ?? undefined,
              fetch: solidFetch,
            }),
    });
  }, [
    runGuardedDelete,
    selected,
    catalogUri,
    storageRootUri,
    entry,
    ownerWebId,
    catalogByContainer,
    solidFetch,
    translate,
    onAfterDelete,
  ]);

  return { handleCopyLink, handleDownload, handleDelete };
}

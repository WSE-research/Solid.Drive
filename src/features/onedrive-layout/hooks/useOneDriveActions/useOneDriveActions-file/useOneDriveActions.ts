/**
 * Selection-aware action handlers (copy link, download, delete) for the
 * OneDrive layout shell. Owns the toast wiring and confirmation prompts
 * so the layout component is reduced to composition.
 *
 * @packageDocumentation
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '@/shared/contexts/NotificationContext';
import { copyToClipboard } from '@/shared/utils/copyToClipboard';
import { deleteResource } from '@/features/file-explorer/services/deleteResource';
import { downloadResource } from '@/features/file-explorer/services/downloadResource';
import { decodeUriTail } from '@/features/onedrive-layout/formatting';
import type { SelectedResource } from '@/features/onedrive-layout/hooks/useSelectedResource';
import type { CatalogEntry } from '@/types';

export interface UseOneDriveActionsArgs {
  selected: SelectedResource;
  catalogByContainer: Map<string, CatalogEntry>;
  catalogUri: string | null | undefined;
  solidFetch: typeof fetch;
  onAfterDelete: () => void;
}

export interface UseOneDriveActionsReturn {
  handleCopyLink: () => Promise<void>;
  handleDownload: () => Promise<void>;
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
}: UseOneDriveActionsArgs): UseOneDriveActionsReturn {
  const [translate] = useTranslation();
  const { showSuccess, showError, confirm } = useNotifications();

  const handleCopyLink = useCallback(async () => {
    if (!selected) return;
    const ok = await copyToClipboard(selected.uri);
    if (ok) {
      showSuccess(
        translate('oneDriveLayout.toast.linkCopied', 'Link copied to clipboard'),
      );
    } else {
      showError(
        translate('oneDriveLayout.toast.linkCopyFail', 'Could not copy link'),
      );
    }
  }, [selected, showSuccess, showError, translate]);

  const handleDownload = useCallback(async () => {
    if (!selected || selected.kind !== 'file') return;
    const fileName = decodeUriTail(selected.uri) || selected.name;
    const result = await downloadResource(selected.uri, fileName, solidFetch);
    if (!result.ok) {
      showError(
        `${translate('oneDriveLayout.toast.downloadFail', 'Download failed')}: ${result.reason}`,
      );
    }
  }, [selected, solidFetch, showError, translate]);

  const handleDelete = useCallback(async () => {
    if (!selected) return;
    const confirmed = await confirm(
      translate('oneDriveLayout.toast.deleteConfirm', {
        defaultValue: 'Delete "{{name}}"? This cannot be undone.',
        name: selected.name,
      }),
    );
    if (!confirmed) return;
    const catalogEntry = catalogByContainer.get(selected.uri);
    const result = await deleteResource({
      containerUri: selected.uri,
      metadataUri: catalogEntry?.uri,
      catalogUri: catalogUri ?? undefined,
      fetch: solidFetch,
    });
    if (!result.ok) {
      showError(
        `${translate('oneDriveLayout.toast.deleteFail', 'Delete failed')}: ${result.reason}`,
      );
      return;
    }
    showSuccess(
      translate('oneDriveLayout.toast.deleteSuccess', {
        defaultValue: '"{{name}}" deleted',
        name: selected.name,
      }),
    );
    onAfterDelete();
  }, [
    selected,
    catalogByContainer,
    catalogUri,
    solidFetch,
    confirm,
    showSuccess,
    showError,
    translate,
    onAfterDelete,
  ]);

  return { handleCopyLink, handleDownload, handleDelete };
}

/**
 * Modal shown when restoring a trashed item finds a different version
 * already at its original location. Lets the person compare both and
 * choose to keep both, replace the current one, or cancel the restore,
 * matching the restore-conflict pattern OneDrive and Dropbox use.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import type { RestoreConflict, RestoreConflictVersion, RestoreResolution } from '@/features/file-explorer/services/restoreTrashedFile';
import { DEFAULT_LOCALE, SHORT_DATE_FORMAT_OPTIONS } from '@/config';
import { formatBytes } from '@/shared/utils/formatBytes';

interface RestoreConflictDialogProps {
  open: boolean;
  itemTitle: string;
  conflict: RestoreConflict;
  isResolving: boolean;
  onResolve: (resolution: RestoreResolution) => void;
  onCancel: () => void;
}

/**
 * Formats one side of a conflict as "date · size", falling back to a
 * translated placeholder when neither detail could be read.
 */
function formatVersion(version: RestoreConflictVersion, unknownLabel: string): string {
  const parts: string[] = [];
  if (version.modified) parts.push(new Date(version.modified).toLocaleDateString(DEFAULT_LOCALE, SHORT_DATE_FORMAT_OPTIONS));
  if (version.byteSize !== undefined) parts.push(formatBytes(String(version.byteSize)));
  return parts.length > 0 ? parts.join(' · ') : unknownLabel;
}

/**
 * Centred modal comparing the trashed version of an item against
 * whatever currently occupies its original location.
 *
 * @public
 */
export const RestoreConflictDialog: FunctionComponent<RestoreConflictDialogProps> = ({
  open,
  itemTitle,
  conflict,
  isResolving,
  onResolve,
  onCancel,
}) => {
  const [translate] = useTranslation();
  const unknownLabel = translate('oneDriveLayout.restoreConflictDialog.unknown', 'Unknown');
  const closeLabel = translate('oneDriveLayout.details.close', 'Close');

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="odl-dialog__overlay" />
        <Dialog.Content className="odl-dialog odl-dialog--restore-conflict" aria-describedby={undefined}>
          <header className="odl-dialog__header">
            <Dialog.Title className="odl-dialog__title">
              {translate('oneDriveLayout.restoreConflictDialog.title', { defaultValue: '"{{name}}" already exists', name: itemTitle })}
            </Dialog.Title>
            <Dialog.Close className="odl-dialog__close" aria-label={closeLabel} onClick={onCancel}>
              ×
            </Dialog.Close>
          </header>

          <p className="odl-restore-conflict__intro">
            {translate('oneDriveLayout.restoreConflictDialog.intro', 'A different version is already there. Choose which one to keep.')}
          </p>

          <dl className="odl-restore-conflict__versions">
            <div className="odl-restore-conflict__version">
              <dt>{translate('oneDriveLayout.restoreConflictDialog.current', 'Current version')}</dt>
              <dd>{formatVersion(conflict.current, unknownLabel)}</dd>
            </div>
            <div className="odl-restore-conflict__version">
              <dt>{translate('oneDriveLayout.restoreConflictDialog.trashed', 'Version from the Recycle Bin')}</dt>
              <dd>{formatVersion(conflict.trashed, unknownLabel)}</dd>
            </div>
          </dl>

          <footer className="odl-dialog__footer">
            <button
              type="button"
              className="odl-dialog__btn odl-dialog__btn--primary"
              disabled={isResolving}
              onClick={() => onResolve('keepBoth')}
            >
              {translate('oneDriveLayout.restoreConflictDialog.keepBoth', 'Keep both')}
            </button>
            <button type="button" className="odl-dialog__btn" disabled={isResolving} onClick={() => onResolve('replace')}>
              {translate('oneDriveLayout.restoreConflictDialog.replace', 'Replace current version')}
            </button>
            <button type="button" className="odl-dialog__btn" disabled={isResolving} onClick={onCancel}>
              {translate('profileSidebar.cancel')}
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

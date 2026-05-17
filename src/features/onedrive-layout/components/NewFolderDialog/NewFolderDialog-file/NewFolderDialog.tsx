/**
 * Modal create-folder dialog used by the OneDrive-inspired layout.
 *
 * Wraps the existing {@link useCreateFolder} hook in a Radix Dialog so the
 * user lands on a centred overlay with a name field and Create / Cancel
 * actions, matching OneDrive's create-a-folder flow.
 *
 * @packageDocumentation
 */

import { useCallback, useState } from 'react';
import type { ChangeEvent, FunctionComponent, KeyboardEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import type { SolidContainer } from '@ldo/connected-solid';
import { useCreateFolder } from '@/features/file-explorer/hooks/useCreateFolder';
import { useNotifications } from '@/shared/contexts/NotificationContext';

interface NewFolderDialogProps {
  open: boolean;
  parentContainer: SolidContainer;
  onOpenChange: (open: boolean) => void;
}

/**
 * Centred modal for creating a new folder under `parentContainer`.
 *
 * @public
 */
export const NewFolderDialog: FunctionComponent<NewFolderDialogProps> = ({
  open,
  parentContainer,
  onOpenChange,
}) => {
  const [translate] = useTranslation();
  const { showError } = useNotifications();
  const { isCreating, createFolder, validateName } = useCreateFolder();

  const [folderName, setFolderName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset the form whenever the dialog reopens. Tracked during render via
  // the previous open state, which is the pattern the project uses to
  // satisfy the react-hooks/set-state-in-effect rule.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setFolderName('');
      setValidationError(null);
    }
  }

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFolderName(event.target.value);
    if (validationError) setValidationError(null);
  };

  const handleSubmit = useCallback(async () => {
    const nameError = validateName(folderName);
    if (nameError !== null) {
      setValidationError(nameError);
      return;
    }
    try {
      await createFolder(parentContainer, folderName);
      onOpenChange(false);
    } catch {
      showError(translate('fileExplorer.newFolderError'));
    }
  }, [
    folderName,
    validateName,
    createFolder,
    parentContainer,
    onOpenChange,
    showError,
    translate,
  ]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void handleSubmit();
    }
  };

  const titleLabel = translate('fileExplorer.newFolderTitle', 'Create a folder');
  const nameLabel = translate('fileExplorer.newFolderName', 'Name');
  const placeholder = translate('fileExplorer.newFolderPlaceholder');
  const createLabel = translate('fileExplorer.createFolder');
  const cancelLabel = translate('profileSidebar.cancel');
  const closeLabel = translate('oneDriveLayout.details.close', 'Close');

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="odl-dialog__overlay" />
        <Dialog.Content
          className="odl-dialog odl-dialog--new-folder"
          aria-describedby={undefined}
        >
          <header className="odl-dialog__header">
            <Dialog.Title className="odl-dialog__title">{titleLabel}</Dialog.Title>
            <Dialog.Close
              className="odl-dialog__close"
              aria-label={closeLabel}
            >
              ×
            </Dialog.Close>
          </header>

          <label className="odl-dialog__field-label" htmlFor="odl-new-folder-name">
            {nameLabel}
          </label>
          <input
            id="odl-new-folder-name"
            className="odl-dialog__input"
            type="text"
            value={folderName}
            placeholder={placeholder}
            onChange={handleNameChange}
            onKeyDown={handleKeyDown}
            disabled={isCreating}
            autoFocus
          />
          {validationError && (
            <span className="odl-dialog__error">{translate(validationError)}</span>
          )}

          <footer className="odl-dialog__footer">
            <button
              type="button"
              className="odl-dialog__btn odl-dialog__btn--primary"
              onClick={() => void handleSubmit()}
              disabled={isCreating || folderName.trim().length === 0}
            >
              {createLabel}
            </button>
            <button
              type="button"
              className="odl-dialog__btn"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              {cancelLabel}
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

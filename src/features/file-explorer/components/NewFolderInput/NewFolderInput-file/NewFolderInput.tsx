/**
 * Inline folder name input shown when the user clicks "New Folder".
 *
 * @packageDocumentation
 */

import { useState, useCallback } from "react";
import type { FunctionComponent } from "react";
import { useTranslation } from "react-i18next";
import type { SolidContainer } from "@ldo/connected-solid";
import { useCreateFolder } from "@/features/file-explorer/hooks/useCreateFolder";
import { useNotifications } from "@/shared/contexts/NotificationContext";

/**
 * Props for the NewFolderInput component.
 */
interface NewFolderInputProps {
  parentContainer: SolidContainer;
  onDone: () => void;
}

/**
 * Inline input form for creating a new folder as an LDP BasicContainer.
 *
 * @public
 */
export const NewFolderInput: FunctionComponent<NewFolderInputProps> = ({ parentContainer, onDone }) => {
  const [translate] = useTranslation();
  const { showError } = useNotifications();
  const { isCreating, createFolder, validateName } = useCreateFolder();
  const [folderName, setFolderName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const inputLabel = translate("fileExplorer.newFolderPlaceholder");
  const submitLabel = translate("fileExplorer.createFolder");
  const cancelLabel = translate("profileSidebar.cancel");

  const handleNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFolderName(event.target.value);
  }, []);

  const handleBlur = useCallback(() => {
    const nameValidationError = validateName(folderName);
    setValidationError(nameValidationError);
  }, [folderName, validateName]);

  const handleCancel = useCallback(() => {
    onDone();
  }, [onDone]);

  const handleSubmit = useCallback(async () => {
    const nameValidationError = validateName(folderName);
    if (nameValidationError !== null) {
      setValidationError(nameValidationError);
      return;
    }
    setValidationError(null);
    try {
      await createFolder(parentContainer, folderName);
      onDone();
    } catch {
      showError(translate("fileExplorer.newFolderError"));
    }
  }, [folderName, validateName, createFolder, parentContainer, onDone, showError, translate]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") void handleSubmit();
  }, [handleSubmit]);

  return (
    <new-folder-input>
      <input
        type="text"
        placeholder={inputLabel}
        aria-label={inputLabel}
        value={folderName}
        onChange={handleNameChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={isCreating}
      />
      {validationError && (
        <span className="new-folder-input__error">{translate(validationError)}</span>
      )}
      <button
        type="button"
        aria-label={submitLabel}
        onClick={handleSubmit}
        disabled={isCreating}
      >
        {submitLabel}
      </button>
      <button
        type="button"
        aria-label={cancelLabel}
        onClick={handleCancel}
        disabled={isCreating}
      >
        {cancelLabel}
      </button>
    </new-folder-input>
  );
};

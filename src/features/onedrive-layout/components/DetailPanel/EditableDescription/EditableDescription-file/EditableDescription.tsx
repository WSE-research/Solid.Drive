/**
 * Inline-editable description input for the DetailPanel. Persists to
 * `schema:description` in the file's index.ttl via LDO on blur or
 * Enter. Surfaces commit failures via the notification context.
 *
 * @packageDocumentation
 */

import { useCallback, useState } from 'react';
import type { ChangeEvent, FunctionComponent, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLdo } from '@ldo/solid-react';
import { CatalogEntryShShapeType } from '@/.ldo/catalogEntry.shapeTypes';
import { useNotifications } from '@/shared/contexts/NotificationContext';

interface EditableDescriptionProps {
  metadataUri: string;
  initial: string | undefined;
  onSaved?: () => void;
}

/**
 * Renders the file's description as an inline-editable input.
 *
 * @public
 */
export const EditableDescription: FunctionComponent<EditableDescriptionProps> = ({
  metadataUri,
  initial,
  onSaved,
}) => {
  const [translate] = useTranslation();
  const { createData, commitData, getResource } = useLdo();
  const { showError } = useNotifications();

  const initialValue = initial ?? '';
  const [value, setValue] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);

  // Reset the in-progress value when the selection moves to a different
  // file. https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [previousMetadataUri, setPreviousMetadataUri] = useState(metadataUri);
  if (previousMetadataUri !== metadataUri) {
    setPreviousMetadataUri(metadataUri);
    setValue(initialValue);
  }

  const placeholder = translate(
    'oneDriveLayout.details.addDescription',
    'Add a description…',
  );
  const savingLabel = translate('oneDriveLayout.details.saving', 'Saving…');
  const errorLabel = translate(
    'oneDriveLayout.details.saveError',
    'Could not save description',
  );

  const persist = useCallback(async () => {
    if (value === initialValue) return;
    setIsSaving(true);
    try {
      const indexResource = getResource(metadataUri);
      const draft = createData(
        CatalogEntryShShapeType,
        metadataUri,
        indexResource,
      );
      const trimmed = value.trim();
      // LDO's createData returns a Proxy that captures patches via property
      // assignment; this mutation is the documented save path, not a normal
      // object update.
      draft.description = trimmed === '' ? undefined : trimmed;
      const result = await commitData(draft);
      if (result.isError) {
        showError(errorLabel);
        setValue(initialValue);
        return;
      }
      onSaved?.();
    } finally {
      setIsSaving(false);
    }
  }, [
    value,
    initialValue,
    metadataUri,
    createData,
    commitData,
    getResource,
    showError,
    errorLabel,
    onSaved,
  ]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) =>
    setValue(event.target.value);
  const handleBlur = () => void persist();
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void persist();
    }
  };

  return (
    <editable-description>
      <input
        type="text"
        className="odl-editable-description__input"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
      />
      {isSaving && (
        <span className="odl-editable-description__saving">{savingLabel}</span>
      )}
    </editable-description>
  );
};

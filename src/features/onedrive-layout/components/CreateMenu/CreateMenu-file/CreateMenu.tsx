/**
 * Create menu anchored on the NavRail's Create control. Two items:
 * "New folder" and "Upload files".
 *
 * @packageDocumentation
 */

import { useRef, type ChangeEvent, type FunctionComponent } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useTranslation } from 'react-i18next';
import { PlusIcon } from '@/features/onedrive-layout/icons';

interface CreateMenuProps {
  /** "New folder" handler. */
  onNewFolder: () => void;
  /** "Upload files" handler, called with the OS-picked files. */
  onFilesPicked: (files: File[]) => void;
  /** Render the pill trigger when true, the icon-only `+` when false. Defaults to false. */
  expanded?: boolean;
  /** Override for the collapsed accessible name. Defaults to the `oneDriveLayout.create` i18n string. */
  labelShort?: string;
  /** Override for the expanded label and accessible name. Defaults to `oneDriveLayout.createOrUpload`. */
  labelLong?: string;
}

/**
 * Two-item dropdown anchored on the rail's Create control. "Upload
 * files" opens the OS file picker via a hidden input.
 *
 * @public
 */
export const CreateMenu: FunctionComponent<CreateMenuProps> = ({
  onNewFolder,
  onFilesPicked,
  expanded = false,
  labelShort,
  labelLong,
}) => {
  const [translate] = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const shortLabel = labelShort ?? translate('oneDriveLayout.create', 'Create');
  const longLabel = labelLong ?? translate('oneDriveLayout.createOrUpload', 'Create or upload');
  const accessibleLabel = expanded ? longLabel : shortLabel;
  const triggerClass = expanded ? 'rail-create rail-create--expanded' : 'rail-create';

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFilesChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length > 0) onFilesPicked(files);
  };

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className={triggerClass}
            aria-label={accessibleLabel}
          >
            <PlusIcon aria-hidden focusable={false} />
            {expanded && <span className="rail-create__label">{longLabel}</span>}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content side="right" sideOffset={8} className="odl-create-menu">
            <DropdownMenu.Item
              className="odl-create-menu__item"
              onSelect={onNewFolder}
            >
              {translate('oneDriveLayout.createMenu.newFolder', 'New folder')}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="odl-create-menu__item"
              onSelect={openFilePicker}
            >
              {translate('oneDriveLayout.createMenu.uploadFiles', 'Upload files')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={handleFilesChosen}
        aria-hidden
      />
    </>
  );
};

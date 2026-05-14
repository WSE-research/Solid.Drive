/**
 * Create menu above the NavRail. "New folder" fires `onNewFolder`.
 * "Upload files" opens the OS file picker via a hidden input and
 * forwards the selection via `onFilesPicked`.
 *
 * @packageDocumentation
 */

import { useRef, type ChangeEvent, type FunctionComponent } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useTranslation } from 'react-i18next';
import { PlusIcon } from '@/features/onedrive-layout/icons';

interface CreateMenuProps {
  onNewFolder: () => void;
  onFilesPicked: (files: File[]) => void;
}

/**
 * Two-item dropdown anchored on the rail's `+` button. Upload files
 * clicks a hidden file input so the OS picker opens on selection.
 *
 * @public
 */
export const CreateMenu: FunctionComponent<CreateMenuProps> = ({
  onNewFolder,
  onFilesPicked,
}) => {
  const [translate] = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            className="rail-create"
            aria-label={translate('oneDriveLayout.create', 'Create')}
          >
            <PlusIcon aria-hidden focusable={false} />
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

/**
 * Create menu rendered above the OneDrive-inspired NavRail. The trigger is
 * the `+` button; selecting an item invokes the matching prop callback so
 * the parent shell can open the right form (NewFolderInput or FileUpload).
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useTranslation } from 'react-i18next';
import { PlusIcon } from '@/features/onedrive-layout/icons';

interface CreateMenuProps {
  onNewFolder: () => void;
  onUploadFiles: () => void;
}

/**
 * Renders the rail's `+` button as a Radix DropdownMenu trigger with
 * two items: "New folder" and "Upload files". Selecting an item fires
 * the matching prop callback so the parent shell can open the right
 * inline form. The menu closes after selection (Radix default).
 *
 * @public
 */
export const CreateMenu: FunctionComponent<CreateMenuProps> = ({
  onNewFolder,
  onUploadFiles,
}) => {
  const [translate] = useTranslation();
  return (
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
            onSelect={onUploadFiles}
          >
            {translate('oneDriveLayout.createMenu.uploadFiles', 'Upload files')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

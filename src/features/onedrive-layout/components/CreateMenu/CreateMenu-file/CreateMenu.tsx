/**
 * Create menu rendered above the OneDrive-inspired NavRail. The trigger
 * is the `+` button; selecting an item invokes the matching prop
 * callback so the parent shell can open the right inline form.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useTranslation } from 'react-i18next';
import { PlusIcon } from '@/features/onedrive-layout/icons';

interface CreateMenuProps {
  onNewFolder?: () => void;
  onUploadFiles?: () => void;
}

/**
 * Create menu trigger and dropdown. When neither `onNewFolder` nor
 * `onUploadFiles` is provided the trigger renders disabled, so callers
 * that don't wire actions yet still get the same chrome instead of an
 * inline placeholder.
 *
 * @public
 */
export const CreateMenu: FunctionComponent<CreateMenuProps> = ({
  onNewFolder,
  onUploadFiles,
}) => {
  const [translate] = useTranslation();
  const disabled = !onNewFolder && !onUploadFiles;
  const triggerLabel = translate('oneDriveLayout.create', 'Create');

  if (disabled) {
    return (
      <button
        type="button"
        className="rail-create"
        aria-label={triggerLabel}
        disabled
      >
        <PlusIcon aria-hidden focusable={false} />
      </button>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="rail-create"
          aria-label={triggerLabel}
        >
          <PlusIcon aria-hidden focusable={false} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content side="right" sideOffset={8} className="odl-create-menu">
          {onNewFolder && (
            <DropdownMenu.Item
              className="odl-create-menu__item"
              onSelect={onNewFolder}
            >
              {translate('oneDriveLayout.createMenu.newFolder', 'New folder')}
            </DropdownMenu.Item>
          )}
          {onUploadFiles && (
            <DropdownMenu.Item
              className="odl-create-menu__item"
              onSelect={onUploadFiles}
            >
              {translate('oneDriveLayout.createMenu.uploadFiles', 'Upload files')}
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

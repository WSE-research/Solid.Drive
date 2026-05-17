/**
 * Modal wrapper around the file-explorer's SharePanel. Radix provides
 * focus trap, Esc, overlay click, scroll lock, and ARIA wiring — this
 * component just composes it.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import { SharePanel } from '@/features/file-explorer/components/SharePanel';
import { CloseIcon } from '@/features/onedrive-layout/icons';
import type { SharedEntry } from '@/types';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  containerUri: string;
  catalogUri: string;
  contacts: string[];
  sharedEntry: SharedEntry;
}

/**
 * @public
 */
export const ShareDialog: FunctionComponent<ShareDialogProps> = ({
  open,
  onOpenChange,
  containerUri,
  catalogUri,
  contacts,
  sharedEntry,
}) => {
  const [translate] = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="odl-dialog-overlay" />
        <Dialog.Content className="odl-dialog-content" aria-describedby={undefined}>
          <div className="odl-dialog-header">
            <Dialog.Title className="odl-dialog-title">
              {translate('oneDriveLayout.action.share', 'Share')}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="odl-toolbar-button"
                aria-label={translate('oneDriveLayout.details.close', 'Close')}
              >
                <CloseIcon aria-hidden focusable={false} />
              </button>
            </Dialog.Close>
          </div>
          <SharePanel
            containerUri={containerUri}
            catalogUri={catalogUri}
            contacts={contacts}
            sharedEntry={sharedEntry}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

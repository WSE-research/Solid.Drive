/**
 * In-app preview for a shared binary. Fetches the file through the
 * session-bound fetch, hands the resulting object URL to
 * {@link FilePreviewBody}, and lets Radix handle the overlay, focus
 * trap, Esc, and scroll lock.
 *
 * @packageDocumentation
 */

import { useEffect, useState } from 'react';
import type { FunctionComponent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import { CloseIcon, DownloadIcon } from '@/features/onedrive-layout/icons';
import { FilePreviewBody } from './FilePreviewBody';
import { IDLE_STATE, LOADING_STATE, UNKNOWN_ERROR_REASON, type LoadState } from './loadState';

/**
 * Props for {@link FilePreviewDialog}. `solidFetch` is the session-
 * bound fetch the dialog uses to load the binary, and `onDownload`
 * is wired to the same handler the parent uses elsewhere so Download
 * behaves the same whether you trigger it from the toolbar or from
 * inside the open dialog.
 */
interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  binaryUri: string;
  title: string;
  mediaType: string;
  solidFetch: typeof fetch;
  onDownload: () => void;
}

/**
 * Renders the modal shell, fetches the binary into an object URL, and
 * hands the result to {@link FilePreviewBody} for display.
 *
 * @public
 */
export const FilePreviewDialog: FunctionComponent<FilePreviewDialogProps> = ({
  open,
  onOpenChange,
  binaryUri,
  title,
  mediaType,
  solidFetch,
  onDownload,
}) => {
  const [translate] = useTranslation();
  const [load, setLoad] = useState<LoadState>(IDLE_STATE);

  useEffect(() => {
    if (!open || !binaryUri) return;
    let cancelled = false;
    let createdObjectUrl: string | null = null;
    void (async () => {
      setLoad(LOADING_STATE);
      try {
        const response = await solidFetch(binaryUri);
        if (cancelled) return;
        if (!response.ok) {
          setLoad({
            status: 'error',
            reason: `${response.status} ${response.statusText}`,
          });
          return;
        }
        const responseBody = await response.blob();
        if (cancelled) return;
        createdObjectUrl = URL.createObjectURL(responseBody);
        setLoad({ status: 'ready', objectUrl: createdObjectUrl });
      } catch (error) {
        if (cancelled) return;
        const reason = error instanceof Error ? error.message : UNKNOWN_ERROR_REASON;
        setLoad({ status: 'error', reason });
      }
    })();
    return () => {
      cancelled = true;
      if (createdObjectUrl) URL.revokeObjectURL(createdObjectUrl);
    };
  }, [open, binaryUri, solidFetch]);

  const closeLabel = translate('oneDriveLayout.details.close', 'Close');
  const downloadLabel = translate('oneDriveLayout.action.download', 'Download');

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="odl-dialog-overlay" />
        <Dialog.Content
          className="odl-dialog-content odl-preview-dialog"
          aria-describedby={undefined}
        >
          <file-preview-header className="odl-dialog-header">
            <Dialog.Title className="odl-dialog-title odl-preview-dialog__title">
              {title}
            </Dialog.Title>
            <file-preview-actions>
              <button
                type="button"
                className="odl-toolbar-button"
                aria-label={downloadLabel}
                onClick={onDownload}
              >
                <DownloadIcon aria-hidden focusable={false} />
                <span>{downloadLabel}</span>
              </button>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="odl-toolbar-button"
                  aria-label={closeLabel}
                >
                  <CloseIcon aria-hidden focusable={false} />
                </button>
              </Dialog.Close>
            </file-preview-actions>
          </file-preview-header>
          <FilePreviewBody load={load} title={title} mediaType={mediaType} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

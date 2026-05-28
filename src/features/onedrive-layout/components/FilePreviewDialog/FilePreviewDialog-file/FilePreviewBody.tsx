/**
 * Body of {@link FilePreviewDialog}: spinner, error message, or the
 * loaded preview delegated to {@link FileMediaPreview}.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { FileMediaPreview } from '@/features/file-explorer/components/FileCard/FileCard-file/FileMediaPreview';
import type { LoadState } from './loadState';

/**
 * Props for {@link FilePreviewBody}. The body only cares about the
 * load state and the metadata it needs to forward to the actual
 * preview element; the dialog above it owns the fetch lifecycle.
 *
 * @public
 */
export interface FilePreviewBodyProps {
  load: LoadState;
  title: string;
  mediaType: string;
}

/**
 * Picks the right rendering for the current load state and forwards
 * the ready preview to {@link FileMediaPreview}.
 *
 * @public
 */
export const FilePreviewBody: FunctionComponent<FilePreviewBodyProps> = ({
  load,
  title,
  mediaType,
}) => {
  const [translate] = useTranslation();

  if (load.status === 'loading' || load.status === 'idle') {
    return (
      <file-preview-body data-state="loading">
        <div className="spinner" />
        <span>{translate('oneDriveLayout.preview.loading', 'Loading preview…')}</span>
      </file-preview-body>
    );
  }

  if (load.status === 'error') {
    return (
      <file-preview-body data-state="error">
        <span>
          {translate('oneDriveLayout.preview.error', 'Could not load preview')}: {load.reason}
        </span>
      </file-preview-body>
    );
  }

  return (
    <file-preview-body>
      <FileMediaPreview
        previewUrl={load.objectUrl}
        mimeType={mediaType}
        name={title}
      />
    </file-preview-body>
  );
};

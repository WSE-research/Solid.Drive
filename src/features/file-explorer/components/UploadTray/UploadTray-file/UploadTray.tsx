/**
 * Persistent uploads tray showing per-file status for bulk drag-and-drop.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from "react";
import { useTranslation } from "react-i18next";
import type { UploadQueueItem } from "@/features/file-explorer/hooks/useUploadQueue";

interface UploadTrayProps {
  items: UploadQueueItem[];
  onDismiss: (id: string) => void;
  onRetry: (id: string) => void;
}

interface UploadTrayRowProps {
  item: UploadQueueItem;
  onDismiss: (id: string) => void;
  onRetry: (id: string) => void;
}

const SETTLED_STATUSES = new Set(["success", "error"]);

const UploadTrayRow: FunctionComponent<UploadTrayRowProps> = ({ item, onDismiss, onRetry }) => {
  const [translate] = useTranslation();
  const rowClassName = `upload-tray-row--${item.status}`;
  const isUploading = item.status === "uploading";
  const isError = item.status === "error";
  const isSuccess = item.status === "success";
  const isQueued = item.status === "queued";
  const isSettled = SETTLED_STATUSES.has(item.status);
  const retryLabel = translate("fileExplorer.uploadTrayRetry");
  const dismissLabel = translate("fileExplorer.uploadTrayDismiss");
  const handleRetryClick = () => onRetry(item.id);
  const handleDismissClick = () => onDismiss(item.id);

  return (
    <upload-tray-row className={rowClassName}>
      <span className="upload-tray-row__name">{item.file.name}</span>
      <span className="upload-tray-row__destination">{item.destinationLabel}</span>
      <span className="upload-tray-row__status">
        {isUploading && <span className="spinner spinner--small" />}
        {isError && <span className="upload-tray-row__error">{item.error}</span>}
        {isSuccess && <span className="upload-tray-row__success">✓</span>}
        {isQueued && <span className="upload-tray-row__queued">…</span>}
      </span>
      <upload-tray-row-actions>
        {isError && (
          <button
            type="button"
            className="btn btn--ghost btn--small"
            aria-label={retryLabel}
            onClick={handleRetryClick}
          >
            {retryLabel}
          </button>
        )}
        {isSettled && (
          <button
            type="button"
            className="btn btn--ghost btn--small"
            aria-label={dismissLabel}
            onClick={handleDismissClick}
          >
            ×
          </button>
        )}
      </upload-tray-row-actions>
    </upload-tray-row>
  );
};

/**
 * Renders the uploads tray in the explorer corner while uploads are
 * active or settled. Owns no state; the parent provides items and
 * receives dismiss and retry callbacks.
 *
 * @public
 */
export const UploadTray: FunctionComponent<UploadTrayProps> = ({ items, onDismiss, onRetry }) => {
  const [translate] = useTranslation();
  if (items.length === 0) return null;
  const headerLabel = translate("fileExplorer.uploadTrayHeader", { count: items.length });
  const clearCompletedLabel = translate("fileExplorer.uploadTrayClearCompleted");
  const handleClearCompleted = () => {
    items
      .filter((item) => SETTLED_STATUSES.has(item.status))
      .forEach((item) => onDismiss(item.id));
  };

  return (
    <upload-tray>
      <header className="upload-tray__header">
        <span className="upload-tray__title">{headerLabel}</span>
        <button type="button" className="btn btn--ghost btn--small" onClick={handleClearCompleted}>
          {clearCompletedLabel}
        </button>
      </header>
      {items.map((item) => (
        <UploadTrayRow key={item.id} item={item} onDismiss={onDismiss} onRetry={onRetry} />
      ))}
    </upload-tray>
  );
};

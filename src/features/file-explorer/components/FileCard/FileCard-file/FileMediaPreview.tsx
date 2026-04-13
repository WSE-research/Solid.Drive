/**
 * Media preview component for file cards.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from "react";
import { MIME_PREFIXES, CONTENT_TYPES } from "@/config";

/**
 * Props for the FileMediaPreview component.
 */
type FileMediaPreviewProps = {
  previewUrl: string;
  mimeType: string;
  name?: string;
};

/**
 * Renders an appropriate preview element based on MIME type.
 * Supports images, videos, audio, PDFs, and text files.
 *
 * @public
 */
export const FileMediaPreview: FunctionComponent<FileMediaPreviewProps> = ({
  previewUrl,
  mimeType,
  name,
}) => {
  const previewLabel = name ?? "Preview";
  const isDocument = mimeType === CONTENT_TYPES.PDF || mimeType.startsWith(MIME_PREFIXES.TEXT);

  if (mimeType.startsWith(MIME_PREFIXES.IMAGE))
    return <img className="file-card__preview" src={previewUrl} alt={previewLabel} />;
  if (mimeType.startsWith(MIME_PREFIXES.VIDEO))
    return <video className="file-card__preview" src={previewUrl} controls />;
  if (mimeType.startsWith(MIME_PREFIXES.AUDIO))
    return <audio className="file-card__preview--audio" src={previewUrl} controls />;
  if (isDocument)
    return <iframe className="file-card__preview--doc" src={previewUrl} title={previewLabel} />;
  return null;
};

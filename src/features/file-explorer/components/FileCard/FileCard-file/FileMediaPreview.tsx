/**
 * Picks the preview element for a file card from its MIME type: image,
 * video, audio, or an inline document frame.
 *
 * @packageDocumentation
 */

import type { FunctionComponent, SyntheticEvent } from "react";
import { MIME_PREFIXES, CONTENT_TYPES } from "@/config";

/**
 * Props for {@link FileMediaPreview}.
 */
type FileMediaPreviewProps = {
  /** Object URL (or src) of the file to preview. */
  previewUrl: string;
  /** MIME type that selects which preview element is rendered. */
  mimeType: string;
  /** Accessible label and frame title; falls back to "Preview". */
  name?: string;
};

/**
 * Paints the browser-rendered text or PDF document to match the preview
 * surface. The frame is a separate document that the app's stylesheets
 * cannot reach, so the rule is injected here rather than written in a
 * `.css` file; its colors come from the host frame's design tokens to
 * stay in sync with the layout.
 */
const applyDarkPreviewTheme = (event: SyntheticEvent<HTMLIFrameElement>): void => {
  const frame = event.currentTarget;
  let frameDocument: Document | null = null;
  try {
    frameDocument = frame.contentDocument;
  } catch {
    return;
  }
  if (!frameDocument?.head) return;

  const tokens = getComputedStyle(frame);
  const background = tokens.getPropertyValue("--odl-bg-elevated").trim();
  const color = tokens.getPropertyValue("--odl-text").trim();

  const style = frameDocument.createElement("style");
  style.textContent = `:root{color-scheme:dark}html,body{background:${background};color:${color}}`;
  frameDocument.head.appendChild(style);
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
    return (
      <img
        className="file-card__preview"
        src={previewUrl}
        alt={previewLabel}
        decoding="async"
        loading="lazy"
      />
    );
  if (mimeType.startsWith(MIME_PREFIXES.VIDEO))
    return (
      <video
        className="file-card__preview"
        src={previewUrl}
        controls
        preload="metadata"
      />
    );
  if (mimeType.startsWith(MIME_PREFIXES.AUDIO))
    return (
      <audio
        className="file-card__preview--audio"
        src={previewUrl}
        controls
        preload="metadata"
      />
    );
  if (isDocument)
    return (
      <iframe
        className="file-card__preview--doc"
        src={previewUrl}
        title={previewLabel}
        onLoad={applyDarkPreviewTheme}
      />
    );
  return null;
};

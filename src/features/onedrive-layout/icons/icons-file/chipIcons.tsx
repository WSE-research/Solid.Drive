/**
 * Self-contained branded icons used by the SharedView filter row and
 * the file rows beneath it.
 *
 * Visual style mirrors OneDrive's inline file glyphs: a light document
 * body with a small brand-colored label strip (Word/Excel/PowerPoint/
 * PDF), a solid yellow folder, and white frames for media types.
 *
 * @packageDocumentation
 */

import type { FunctionComponent, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const FONT_FAMILY =
  '-apple-system, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const DOCUMENT_BODY_D =
  'M6 3h8.5L19 7.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z';
const DOCUMENT_FOLD_D = 'M14.5 3v4.5H19';

const BODY_FILL = '#f3f4f6';
const FOLD_FILL = '#cbd5e1';

interface OfficeDocumentIconProps extends IconProps {
  /** Brand color for the label strip. */
  badgeColor: string;
  /** Letter rendered inside the label strip (white). */
  letter: string;
  /** SVG font size for the letter glyph (defaults tuned for single letters). */
  letterFontSize?: number;
}

/**
 * Generic Office-app document icon — a light document silhouette with
 * a small brand-colored label strip across the lower portion. Used by
 * Word / Excel / PowerPoint / PDF chips.
 *
 * @internal
 */
const OfficeDocumentIcon: FunctionComponent<OfficeDocumentIconProps> = ({
  badgeColor,
  letter,
  letterFontSize = 5.5,
  ...rest
}) => (
  <svg viewBox="0 0 24 24" aria-hidden focusable={false} {...rest}>
    <path d={DOCUMENT_BODY_D} fill={BODY_FILL} />
    <path d={DOCUMENT_FOLD_D} fill={FOLD_FILL} />
    <rect x="4.5" y="13.5" width="11" height="6" rx="0.6" fill={badgeColor} />
    <text
      x="10"
      y="18"
      textAnchor="middle"
      fontSize={letterFontSize}
      fontWeight="900"
      letterSpacing="0.1"
      fontFamily={FONT_FAMILY}
      fill="#ffffff"
    >
      {letter}
    </text>
  </svg>
);

/** Word-style chip icon — light document with blue "W" label. */
export const WordChipIcon: FunctionComponent<IconProps> = (props) => (
  <OfficeDocumentIcon badgeColor="#185abd" letter="W" {...props} />
);

/** Excel-style chip icon — light document with green "X" label. */
export const ExcelChipIcon: FunctionComponent<IconProps> = (props) => (
  <OfficeDocumentIcon badgeColor="#107c41" letter="X" {...props} />
);

/** PowerPoint-style chip icon — light document with orange "P" label. */
export const PowerPointChipIcon: FunctionComponent<IconProps> = (props) => (
  <OfficeDocumentIcon badgeColor="#c43e1c" letter="P" {...props} />
);

/** PDF chip icon — light document with red "PDF" label. */
export const PdfChipIcon: FunctionComponent<IconProps> = (props) => (
  <OfficeDocumentIcon badgeColor="#b91c1c" letter="PDF" letterFontSize={4.2} {...props} />
);

/** Folder chip icon — solid yellow folder shape. */
export const FolderChipIcon: FunctionComponent<IconProps> = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden focusable={false} {...props}>
    <path
      d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4.6l1.7 2H19.5A1.5 1.5 0 0 1 21 9.5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5z"
      fill="#f5b942"
    />
    <path
      d="M3 9.5h18V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5z"
      fill="#e6a930"
    />
  </svg>
);

/** Image chip icon — light frame with mountain + sun motif. */
export const ImageChipIcon: FunctionComponent<IconProps> = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden focusable={false} {...props}>
    <rect x="3" y="5" width="18" height="14" rx="1.5" fill={BODY_FILL} stroke={FOLD_FILL} strokeWidth="0.5" />
    <circle cx="8.5" cy="10" r="1.6" fill="#fbbf24" />
    <path d="M3.5 18 9 12.5l3.5 3 3-2.5L20.5 18z" fill="#0d9488" />
  </svg>
);

/** Video chip icon — light frame with purple play triangle. */
export const VideoChipIcon: FunctionComponent<IconProps> = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden focusable={false} {...props}>
    <rect x="3" y="6" width="14" height="12" rx="1.5" fill={BODY_FILL} stroke={FOLD_FILL} strokeWidth="0.5" />
    <path d="M21 7.5v9l-3.5-2.5v-4z" fill="#7c3aed" />
    <path d="M9 9.2 14.6 12 9 14.8z" fill="#7c3aed" />
  </svg>
);

/** Audio chip icon — light document with cyan music note. */
export const AudioChipIcon: FunctionComponent<IconProps> = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden focusable={false} {...props}>
    <path d={DOCUMENT_BODY_D} fill={BODY_FILL} />
    <path d={DOCUMENT_FOLD_D} fill={FOLD_FILL} />
    <path
      d="M10 11.5 16 10.4v6.4a1.7 1.7 0 1 1-1.2-1.6V12.6l-3.6.7v4.7a1.7 1.7 0 1 1-1.2-1.6z"
      fill="#0891b2"
    />
  </svg>
);

/** Generic file chip icon — light document with subtle text lines. */
export const GenericFileChipIcon: FunctionComponent<IconProps> = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden focusable={false} {...props}>
    <path d={DOCUMENT_BODY_D} fill={BODY_FILL} />
    <path d={DOCUMENT_FOLD_D} fill={FOLD_FILL} />
    <path d="M8 11h8v1.2H8zM8 13.5h8v1.2H8zM8 16h5v1.2H8z" fill="#94a3b8" />
  </svg>
);

/**
 * Chip catalog for the SharedView filter row.
 *
 * Chips are derived from the actual entries observed in the user's
 * shared catalogs — one chip per distinct schema.org class plus a
 * dedicated "Folder" chip when at least one container is present.
 *
 * @packageDocumentation
 */

import type { ComponentType, SVGProps } from 'react';
import { getFileTypeInfo } from '@/infrastructure/validation/fileTypeRegistry';
import {
  WordChipIcon,
  ExcelChipIcon,
  PowerPointChipIcon,
  PdfChipIcon,
  FolderChipIcon,
  ImageChipIcon,
  VideoChipIcon,
  AudioChipIcon,
  GenericFileChipIcon,
} from '@/features/onedrive-layout/icons';

/**
 * Minimal entry shape used by chip predicates and chip derivation.
 *
 * @public
 */
export interface ChipEntry {
  /** True when the entry represents a folder / container. */
  isFolder?: boolean;
  /** schema.org class URI from the catalog entry. */
  conformsTo?: string;
  /** RFC 6838 media type (used as a secondary signal — e.g. PDF). */
  mediaType?: string;
  /** File name (used by extension fallbacks — e.g. .pdf). */
  name?: string;
}

/**
 * Reserved id used by the synthetic "Folder" chip.
 *
 * @public
 */
export const FOLDER_CHIP_ID = '__folder__';

/**
 * One filter chip definition emitted by {@link deriveChipsFromEntries}.
 *
 * @public
 */
export interface FilterChipDef {
  id: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconAccent: string;
  matches: (entry: ChipEntry) => boolean;
}

interface ClassVisual {
  Icon: FilterChipDef['Icon'];
  accent: string;
}

/**
 * Maps a schema.org class URI's local id (e.g. `ImageObject`) to a
 * branded icon + accent color. Anything not listed here falls back to
 * the generic document tile.
 *
 * @internal
 */
const VISUAL_BY_CLASS_ID: Record<string, ClassVisual> = {
  ImageObject: { Icon: ImageChipIcon, accent: '#0d9488' },
  VideoObject: { Icon: VideoChipIcon, accent: '#7c3aed' },
  AudioObject: { Icon: AudioChipIcon, accent: '#0891b2' },
  SpreadsheetDigitalDocument: { Icon: ExcelChipIcon, accent: '#107c41' },
  PresentationDigitalDocument: { Icon: PowerPointChipIcon, accent: '#c43e1c' },
  TextDigitalDocument: { Icon: WordChipIcon, accent: '#185abd' },
  DigitalDocument: { Icon: GenericFileChipIcon, accent: '#475569' },
};

/**
 * Returns the local id portion of a schema.org class URI.
 *
 * @internal
 */
function localId(classUri: string): string {
  const lastSlash = classUri.lastIndexOf('/');
  return lastSlash >= 0 ? classUri.slice(lastSlash + 1) : classUri;
}

/**
 * Synthesizes a chip definition for a schema.org class URI. Used by
 * the derive function — exported so tests can verify the icon mapping.
 *
 * @public
 */
export function chipForClassUri(classUri: string): FilterChipDef {
  const id = localId(classUri);
  const visual = VISUAL_BY_CLASS_ID[id] ?? {
    Icon: GenericFileChipIcon,
    accent: '#5854d6',
  };
  return {
    id: classUri,
    label: getFileTypeInfo(classUri).label,
    Icon: visual.Icon,
    iconAccent: visual.accent,
    matches: (entry) => entry.conformsTo === classUri,
  };
}

/**
 * Synthesizes the dedicated Folder chip.
 *
 * @public
 */
export function chipForFolder(): FilterChipDef {
  return {
    id: FOLDER_CHIP_ID,
    label: 'Folder',
    Icon: FolderChipIcon,
    iconAccent: '#eab308',
    matches: (entry) => entry.isFolder === true,
  };
}

/**
 * Synthetic PDF chip — `application/pdf` doesn't have its own
 * schema.org class, so we derive a dedicated chip for it whenever PDF
 * entries are observed.
 *
 * @public
 */
export const PDF_CHIP_ID = '__pdf__';

const PDF_MEDIA_TYPE = 'application/pdf';

function entryIsPdf(entry: ChipEntry): boolean {
  if (entry.mediaType?.toLowerCase() === PDF_MEDIA_TYPE) return true;
  return entry.name?.toLowerCase().endsWith('.pdf') === true;
}

/**
 * Synthesizes the dedicated PDF chip. Exported for symmetry with
 * {@link chipForClassUri} and {@link chipForFolder}.
 *
 * @public
 */
export function chipForPdf(): FilterChipDef {
  return {
    id: PDF_CHIP_ID,
    label: 'PDF',
    Icon: PdfChipIcon,
    iconAccent: '#b91c1c',
    matches: entryIsPdf,
  };
}

/**
 * Walks a list of observed entries and returns one chip per distinct
 * schema.org class, plus dedicated chips for Folders and PDFs when
 * relevant entries are observed. Chips are sorted with synthetic
 * chips (Folder, PDF) first, then schema.org class chips alphabetical.
 *
 * @public
 */
export function deriveChipsFromEntries(entries: readonly ChipEntry[]): FilterChipDef[] {
  const observedClasses = new Set<string>();
  let hasFolder = false;
  let hasPdf = false;
  for (const entry of entries) {
    if (entry.isFolder) hasFolder = true;
    if (entryIsPdf(entry)) hasPdf = true;
    if (entry.conformsTo && entry.conformsTo.length > 0) {
      observedClasses.add(entry.conformsTo);
    }
  }

  const classChips = [...observedClasses]
    .map(chipForClassUri)
    .sort((left, right) => left.label.localeCompare(right.label));

  const synthetic: FilterChipDef[] = [];
  if (hasFolder) synthetic.push(chipForFolder());
  if (hasPdf) synthetic.push(chipForPdf());

  return [...synthetic, ...classChips];
}

/**
 * True when the entry matches at least one of the selected chip ids
 * within the given chip set. Empty selection means "all".
 *
 * @public
 */
export function entryMatchesChipSelection(
  entry: ChipEntry,
  selected: ReadonlySet<string>,
  chips: readonly FilterChipDef[],
): boolean {
  if (selected.size === 0) return true;
  for (const chip of chips) {
    if (selected.has(chip.id) && chip.matches(entry)) return true;
  }
  return false;
}

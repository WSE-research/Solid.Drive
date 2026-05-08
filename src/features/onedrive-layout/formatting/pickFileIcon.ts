/**
 * Picks a branded chip icon for a file or folder row in the My Files
 * panel. The same chip catalog that powers the SharedView toolbar is
 * reused here so the icons stay visually consistent across views.
 *
 * @packageDocumentation
 */

import type { FilterChipDef } from '@/features/onedrive-layout/components/filters/TypeFilterChips/TypeFilterChips-file/chipCatalog';
import {
  chipForClassUri,
  chipForFolder,
  chipForPdf,
} from '@/features/onedrive-layout/components/filters/TypeFilterChips/TypeFilterChips-file/chipCatalog';

/**
 * Picks an icon component (and its accent color) for a folder row.
 *
 * @public
 */
export function pickFolderIcon(): {
  Icon: FilterChipDef['Icon'];
  accent: string;
} {
  const folder = chipForFolder();
  return { Icon: folder.Icon, accent: folder.iconAccent };
}

/**
 * Picks an icon component (and its accent color) for a file row.
 * PDF wins over the schema.org class because users recognise the red
 * PDF tile far faster than a generic "DigitalDocument" label. Falls
 * back to the generic document tile when nothing matches.
 *
 * @public
 */
export function pickFileIcon(input: {
  name: string;
  mediaType?: string;
  conformsTo?: string;
}): { Icon: FilterChipDef['Icon']; accent: string } {
  const pdf = chipForPdf();
  if (
    pdf.matches({
      mediaType: input.mediaType,
      name: input.name,
    })
  ) {
    return { Icon: pdf.Icon, accent: pdf.iconAccent };
  }
  if (input.conformsTo) {
    const chip = chipForClassUri(input.conformsTo);
    return { Icon: chip.Icon, accent: chip.iconAccent };
  }
  const fallback = chipForClassUri('http://schema.org/DigitalDocument');
  return { Icon: fallback.Icon, accent: fallback.iconAccent };
}

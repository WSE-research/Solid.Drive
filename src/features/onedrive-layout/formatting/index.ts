/**
 * Shared row-formatting helpers used across the OneDrive layout views.
 * Importers should target this barrel rather than the individual files
 * so the underlying organisation stays free to evolve.
 *
 * @packageDocumentation
 */

export {
  EMPTY_CELL,
  containerUriFromCatalogUri,
  decodeUriTail,
  formatCatalogSize,
  formatModifiedDate,
  formatRowDate,
  isActivationKey,
  parentFolderLabel,
  safeDecodeUriTail,
} from './fileRowFormatting';
export { pickFileIcon, pickFolderIcon } from './pickFileIcon';

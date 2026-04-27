/**
 * Drag-and-drop utilities for the file explorer.
 *
 * @packageDocumentation
 */

interface DataTransferItemWithEntry extends Omit<DataTransferItem, 'webkitGetAsEntry'> {
  webkitGetAsEntry?: () => { isDirectory: boolean; isFile: boolean } | null;
}

/**
 * Reports whether the drag payload contains a directory.
 *
 * @remarks
 * Inspects each `DataTransferItem` synchronously via `webkitGetAsEntry`
 * and returns true as soon as one directory is found. Folder uploads are
 * out of scope for issue #25, so the drop handler uses this signal to
 * surface a dedicated "folders aren't supported" message before
 * validation runs.
 *
 * @param dataTransfer - Native DataTransfer from a drop or dragenter event
 * @returns True when at least one item is a directory
 *
 * @public
 */
export function hasUnsupportedFolderDrop(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer?.items) return false;
  for (let index = 0; index < dataTransfer.items.length; index += 1) {
    const item = dataTransfer.items[index] as DataTransferItemWithEntry;
    if (item.kind !== "file") continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry?.isDirectory) return true;
  }
  return false;
}

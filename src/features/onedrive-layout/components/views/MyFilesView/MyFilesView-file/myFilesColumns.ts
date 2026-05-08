/**
 * Column descriptor for the My Files table. Co-located with the table
 * head so adding a column is a single-file change.
 *
 * @packageDocumentation
 */

export interface MyFilesColumn {
  readonly id: 'name' | 'modified' | 'size' | 'sharing';
  readonly i18nKey: string;
  readonly fallbackLabel: string;
}

export const MY_FILES_COLUMNS: readonly MyFilesColumn[] = [
  { id: 'name',     i18nKey: 'oneDriveLayout.column.name',     fallbackLabel: 'Name' },
  { id: 'modified', i18nKey: 'oneDriveLayout.column.modified', fallbackLabel: 'Modified' },
  { id: 'size',     i18nKey: 'oneDriveLayout.column.size',     fallbackLabel: 'File size' },
  { id: 'sharing',  i18nKey: 'oneDriveLayout.column.sharing',  fallbackLabel: 'Sharing' },
];

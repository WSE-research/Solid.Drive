/**
 * Four-column header row shared by both the browse-mode table
 * ({@link MyFilesTable}) and the search-mode table
 * ({@link MyFilesSearchTable}). Single source of truth for the column
 * labels so the two tables stay aligned.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { MY_FILES_COLUMNS } from './myFilesColumns';

/**
 * Renders the table's header row with the localized column labels.
 *
 * @public
 */
export const MyFilesTableHead: FunctionComponent = () => {
  const [translate] = useTranslation();
  return (
    <div className="odl-files-table__head" role="row">
      {MY_FILES_COLUMNS.map((column) => (
        <div key={column.id} role="columnheader">
          {translate(column.i18nKey, column.fallbackLabel)}
        </div>
      ))}
    </div>
  );
};

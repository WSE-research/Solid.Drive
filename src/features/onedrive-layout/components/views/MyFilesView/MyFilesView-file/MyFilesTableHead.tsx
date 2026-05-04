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

/**
 * Renders the table's header row with the localized column labels.
 *
 * @public
 */
export const MyFilesTableHead: FunctionComponent = () => {
  const [translate] = useTranslation();
  return (
    <div className="odl-files-table__head" role="row">
      <div role="columnheader">
        {translate('oneDriveLayout.column.name', 'Name')}
      </div>
      <div role="columnheader">
        {translate('oneDriveLayout.column.modified', 'Modified')}
      </div>
      <div role="columnheader">
        {translate('oneDriveLayout.column.size', 'File size')}
      </div>
      <div role="columnheader">
        {translate('oneDriveLayout.column.sharing', 'Sharing')}
      </div>
    </div>
  );
};

/**
 * Selection-mode toolbar for the Shared view. Reuses the same
 * `page-header` + `selection-actions` + `page-header-right` shell as
 * the My Files selection toolbar so the visual treatment and the
 * grid slot stay consistent across views.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { OpenIcon, DownloadIcon, CloseIcon } from '@/features/onedrive-layout/icons';

/**
 * Props for {@link SharedSelectionToolbar}. The actions are passed in
 * so the parent stays in charge of what Open and Download mean for the
 * currently selected entry.
 *
 * @public
 */
export interface SharedSelectionToolbarProps {
  count: number;
  onOpen: () => void;
  onDownload: () => void;
  onClear: () => void;
}

/**
 * Renders the Open and Download buttons next to a clearable selection
 * count, wrapped in the standard selection-mode page-header shell.
 *
 * @public
 */
export const SharedSelectionToolbar: FunctionComponent<SharedSelectionToolbarProps> = ({
  count,
  onOpen,
  onDownload,
  onClear,
}) => {
  const [translate] = useTranslation();
  const openLabel = translate('oneDriveLayout.action.open', 'Open');
  const downloadLabel = translate('oneDriveLayout.action.download', 'Download');
  const clearLabel = translate(
    'oneDriveLayout.action.clearSelection',
    'Clear selection',
  );
  const countLabel = translate(
    'oneDriveLayout.action.selectionCount',
    '{{count}} selected',
    { count },
  );

  return (
    <page-header data-selection-active="true">
      <selection-actions>
        <button
          type="button"
          className="odl-toolbar-button"
          aria-label={openLabel}
          onClick={onOpen}
        >
          <OpenIcon aria-hidden focusable={false} />
          <span>{openLabel}</span>
        </button>
        <button
          type="button"
          className="odl-toolbar-button"
          aria-label={downloadLabel}
          onClick={onDownload}
        >
          <DownloadIcon aria-hidden focusable={false} />
          <span>{downloadLabel}</span>
        </button>
      </selection-actions>

      <page-header-right>
        <button
          type="button"
          className="odl-selection-badge"
          aria-label={clearLabel}
          onClick={onClear}
        >
          <CloseIcon aria-hidden focusable={false} />
          <span>{countLabel}</span>
        </button>
      </page-header-right>
    </page-header>
  );
};

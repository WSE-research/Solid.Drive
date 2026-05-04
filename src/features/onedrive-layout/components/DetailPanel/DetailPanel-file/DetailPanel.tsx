/**
 * Right-edge slide-in panel that displays metadata for the currently
 * selected file or folder. Owns no state — `open` and `selected` are
 * controlled by the parent shell.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { CloseIcon } from '@/features/onedrive-layout/icons';
import type { SelectedResource } from '@/features/onedrive-layout/hooks/useSelectedResource';

interface DetailPanelProps {
  open: boolean;
  selected: SelectedResource;
  onClose: () => void;
}

/**
 * Renders the right-edge detail panel. When `selected` is set, shows
 * the resource's name + kind; otherwise shows a localized empty hint.
 * Closed state (`open === false`) is communicated via `aria-hidden` so
 * the surrounding CSS can collapse the grid column with a transition.
 *
 * @public
 */
export const DetailPanel: FunctionComponent<DetailPanelProps> = ({
  open,
  selected,
  onClose,
}) => {
  const [translate] = useTranslation();
  return (
    <detail-panel
      aria-hidden={open ? 'false' : 'true'}
      data-open={open ? 'true' : 'false'}
    >
      <detail-panel-header>
        <h3>
          {selected
            ? selected.name
            : translate('oneDriveLayout.details.title', 'Details')}
        </h3>
        <button
          type="button"
          className="odl-toolbar-button"
          aria-label={translate('oneDriveLayout.details.close', 'Close')}
          onClick={onClose}
        >
          <CloseIcon aria-hidden focusable={false} />
        </button>
      </detail-panel-header>
      {selected ? (
        <detail-panel-body>
          <p className="odl-details__kind">
            {selected.kind === 'file'
              ? translate('oneDriveLayout.details.kindFile', 'File')
              : translate('oneDriveLayout.details.kindFolder', 'Folder')}
          </p>
        </detail-panel-body>
      ) : (
        <detail-panel-empty>
          {translate(
            'oneDriveLayout.details.empty',
            'Select an item to see its details.',
          )}
        </detail-panel-empty>
      )}
    </detail-panel>
  );
};

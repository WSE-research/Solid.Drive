/**
 * Right-edge slide-in panel that displays metadata for the currently
 * selected file or folder. Owns no state — `open`, `selected`, and
 * `details` are controlled by the parent shell.
 *
 * For files: header (type icon + name + close), thumbnail block,
 * editable description, "Has access" avatars, "More details" divider,
 * then label/value rows for Type, Size, Created, Modified, Pod URI.
 *
 * For folders: same layout minus the thumbnail and Type rows; Size is
 * replaced by item count.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { CloseIcon, MyFilesIcon } from '@/features/onedrive-layout/icons';
import {
  formatCatalogSize,
  formatModifiedDate,
  EMPTY_CELL,
} from '@/features/onedrive-layout/components/views/MyFilesView/MyFilesView-file/fileRowFormatting';
import type { SelectedResource } from '@/features/onedrive-layout/hooks/useSelectedResource';
import type { ResourceDetails } from '@/features/onedrive-layout/hooks/useResourceDetails';
import { EditableDescription } from '../EditableDescription';
import { HasAccessRow } from '../HasAccessRow';

interface DetailPanelProps {
  open: boolean;
  selected: SelectedResource;
  details: ResourceDetails | null;
  onClose: () => void;
}

interface DetailRow {
  label: string;
  value: string;
}

/**
 * Renders the right-edge detail panel. When `details` is set, shows the
 * full structured body for the selected file or folder; otherwise shows
 * a localized empty hint. Closed state (`open === false`) is communicated
 * via `aria-hidden` so the surrounding CSS can collapse the grid column
 * with a transition.
 *
 * @public
 */
export const DetailPanel: FunctionComponent<DetailPanelProps> = ({
  open,
  selected,
  details,
  onClose,
}) => {
  const [translate] = useTranslation();

  const closeButton = (
    <button
      type="button"
      className="odl-toolbar-button"
      aria-label={translate('oneDriveLayout.details.close', 'Close')}
      onClick={onClose}
    >
      <CloseIcon aria-hidden focusable={false} />
    </button>
  );

  return (
    <detail-panel
      aria-hidden={open ? 'false' : 'true'}
      data-open={open ? 'true' : 'false'}
    >
      <detail-panel-header>
        {details && <MyFilesIcon aria-hidden focusable={false} />}
        <h3>
          {details
            ? details.name
            : translate('oneDriveLayout.details.title', 'Details')}
        </h3>
        {closeButton}
      </detail-panel-header>
      {!details || !selected ? (
        <detail-panel-empty>
          {translate(
            'oneDriveLayout.details.empty',
            'Select an item to see its details.',
          )}
        </detail-panel-empty>
      ) : (
        <DetailPanelBody details={details} />
      )}
    </detail-panel>
  );
};

interface DetailPanelBodyProps {
  details: NonNullable<ResourceDetails>;
}

const DetailPanelBody: FunctionComponent<DetailPanelBodyProps> = ({
  details,
}) => {
  const [translate] = useTranslation();

  const rows: DetailRow[] =
    details.kind === 'file'
      ? [
          {
            label: translate('oneDriveLayout.details.type', 'Type'),
            value: details.mediaType ?? EMPTY_CELL,
          },
          {
            label: translate('oneDriveLayout.details.size', 'Size'),
            value: formatCatalogSize(details.byteSize),
          },
          ...(details.created
            ? [
                {
                  label: translate(
                    'oneDriveLayout.details.created',
                    'Created',
                  ),
                  value: formatModifiedDate(details.created),
                },
              ]
            : []),
          {
            label: translate('oneDriveLayout.details.modified', 'Modified'),
            value: formatModifiedDate(details.modified),
          },
          {
            label: translate('oneDriveLayout.details.podUri', 'Pod URI'),
            value: details.uri,
          },
        ]
      : [
          {
            label: translate('oneDriveLayout.details.itemCount', 'Items'),
            value: String(details.itemCount),
          },
          {
            label: translate('oneDriveLayout.details.modified', 'Modified'),
            value: formatModifiedDate(details.modified),
          },
          {
            label: translate('oneDriveLayout.details.podUri', 'Pod URI'),
            value: details.uri,
          },
        ];

  return (
    <detail-panel-body>
      {details.kind === 'file' && (
        <>
          <detail-panel-thumbnail>
            <MyFilesIcon aria-hidden focusable={false} />
          </detail-panel-thumbnail>
          <EditableDescription
            metadataUri={details.metadataUri}
            initial={details.description}
          />
        </>
      )}
      <detail-panel-section>
        <h4 className="odl-details__section-title">
          {translate('oneDriveLayout.details.hasAccess', 'Has access')}
        </h4>
        <HasAccessRow uri={details.uri} />
      </detail-panel-section>
      <detail-panel-divider>
        <span>
          {translate('oneDriveLayout.details.moreDetails', 'More details')}
        </span>
      </detail-panel-divider>
      <detail-panel-section>
        {rows.map((row) => (
          <detail-panel-row key={row.label}>
            <span className="odl-details__label">{row.label}</span>
            <span className="odl-details__value">{row.value}</span>
          </detail-panel-row>
        ))}
      </detail-panel-section>
    </detail-panel-body>
  );
};

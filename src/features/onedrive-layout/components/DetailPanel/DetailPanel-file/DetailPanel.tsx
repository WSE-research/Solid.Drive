/**
 * Right-edge slide-in panel that displays metadata for the selected
 * file or folder. Stateless: `open`, `selected`, and `details` are
 * controlled by the parent shell.
 *
 * Files render a thumbnail preview + Type/Size/Created/Modified rows.
 * Folders render the same layout minus the thumbnail and Type, with
 * Size replaced by item count.
 *
 * @packageDocumentation
 */

import { useMemo } from 'react';
import type { FunctionComponent } from 'react';
import { useResource } from '@ldo/solid-react';
import type { SolidLeaf } from '@ldo/connected-solid';
import { useTranslation } from 'react-i18next';
import { useFilePreview } from '@/features/file-explorer';
import { isSolidContainer } from '@/infrastructure/solid/resourceGuards';
import { INDEX_FILE } from '@/config';
import { CloseIcon } from '@/features/onedrive-layout/icons';
import {
  formatCatalogSize,
  formatModifiedDate,
  EMPTY_CELL,
  pickFileIcon,
  pickFolderIcon,
} from '@/features/onedrive-layout/formatting';
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

// Same catalog the file rows use, so the header glyph matches the row.
function pickHeaderIcon(details: NonNullable<ResourceDetails>) {
  if (details.kind === 'folder') return pickFolderIcon();
  return pickFileIcon({
    name: details.name,
    mediaType: details.mediaType,
    conformsTo: details.conformsTo,
  });
}

const ResourceIcon: FunctionComponent<{ details: NonNullable<ResourceDetails> }> = ({ details }) => {
  const { Icon } = pickHeaderIcon(details);
  return <Icon aria-hidden focusable={false} />;
};

type PreviewKind = 'image' | 'video' | 'audio' | 'document' | 'none';

// Returns 'none' for types we can't embed safely (archives, Office
// docs without a server-side renderer); the panel falls back to the
// branded icon in that case.
function pickPreviewKind(mediaType: string | undefined): PreviewKind {
  const type = mediaType?.toLowerCase();
  if (!type) return 'none';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (type === 'application/pdf' || type.startsWith('text/')) return 'document';
  return 'none';
}

interface FilePreviewProps {
  details: Extract<NonNullable<ResourceDetails>, { kind: 'file' }>;
}

const FilePreview: FunctionComponent<FilePreviewProps> = ({ details }) => {
  // When the catalog already knows the binary URI (the common case for
  // catalog-backed files), use it directly so the image fetch can start
  // immediately. Fall back to a container scan only for files that
  // are selected but not in the catalog yet.
  const needsContainerScan = !details.binaryUri;
  const containerResource = useResource(
    needsContainerScan ? details.uri : undefined,
  );
  const scannedBinaryUri = useMemo(() => {
    if (!needsContainerScan) return undefined;
    if (!isSolidContainer(containerResource)) return undefined;
    const leaf = containerResource
      .children()
      .find(
        (child): child is SolidLeaf =>
          !isSolidContainer(child) && !child.uri.endsWith(INDEX_FILE),
      );
    return leaf?.uri;
  }, [needsContainerScan, containerResource]);
  const { previewUrl } = useFilePreview(details.binaryUri ?? scannedBinaryUri);
  const kind = pickPreviewKind(details.mediaType);

  if (!previewUrl || kind === 'none') {
    return (
      <detail-panel-thumbnail data-preview-kind="icon">
        <ResourceIcon details={details} />
      </detail-panel-thumbnail>
    );
  }

  return (
    <detail-panel-thumbnail data-preview-kind={kind}>
      {kind === 'image' && (
        <img
          src={previewUrl}
          alt={details.name}
          decoding="async"
          loading="eager"
        />
      )}
      {kind === 'video' && (
        <video src={previewUrl} controls preload="metadata" />
      )}
      {kind === 'audio' && (
        <audio src={previewUrl} controls preload="metadata" />
      )}
      {kind === 'document' && (
        <iframe src={previewUrl} title={details.name} />
      )}
    </detail-panel-thumbnail>
  );
};

/**
 * Closed state is communicated via `aria-hidden` so the CSS can
 * collapse the grid column with a transition.
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
        {details && <ResourceIcon details={details} />}
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

type Translate = ReturnType<typeof useTranslation>[0];

const buildFileRows = (
  details: Extract<NonNullable<ResourceDetails>, { kind: 'file' }>,
  translate: Translate,
): DetailRow[] => [
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
          label: translate('oneDriveLayout.details.created', 'Created'),
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
];

const buildFolderRows = (
  details: Extract<NonNullable<ResourceDetails>, { kind: 'folder' }>,
  translate: Translate,
): DetailRow[] => [
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

const DetailPanelBody: FunctionComponent<DetailPanelBodyProps> = ({
  details,
}) => {
  const [translate] = useTranslation();

  const rows: DetailRow[] =
    details.kind === 'file'
      ? buildFileRows(details, translate)
      : buildFolderRows(details, translate);

  return (
    <detail-panel-body>
      {details.kind === 'file' && (
        <>
          <FilePreview details={details} />
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

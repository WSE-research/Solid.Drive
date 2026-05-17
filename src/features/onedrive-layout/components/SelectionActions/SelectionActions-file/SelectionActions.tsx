/**
 * Page-header action strip that surfaces resource-specific actions when
 * the user has a file or folder selected: Share / Copy link / Delete /
 * Download / Move To / Rename. Move To and Rename carry
 * `data-stub="true"` — their full behaviour is tracked in #36.
 *
 * Renders nothing when `selection` is null — the page-header keeps the
 * page title on the left in that state.
 *
 * @packageDocumentation
 */

import type { ComponentType, FunctionComponent, SVGProps } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShareIcon,
  LinkIcon,
  DeleteIcon,
  DownloadIcon,
  MoveToIcon,
  RenameIcon,
} from '@/features/onedrive-layout/icons';
import type { SelectedResource } from '@/features/onedrive-layout/hooks/useSelectedResource';

interface SelectionActionsProps {
  selection: SelectedResource;
  onShare: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onMoveTo: () => void;
  onRename: () => void;
}

interface ActionButtonProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  onClick: () => void;
  stub?: boolean;
}

const ActionButton: FunctionComponent<ActionButtonProps> = ({
  icon: Icon,
  label,
  onClick,
  stub,
}) => (
  <button
    type="button"
    className="odl-toolbar-button"
    aria-label={label}
    onClick={onClick}
    {...(stub ? { 'data-stub': 'true' } : {})}
  >
    <Icon aria-hidden focusable={false} />
    <span>{label}</span>
  </button>
);

/**
 * Renders the selection-aware action strip. See file docs.
 *
 * @public
 */
export const SelectionActions: FunctionComponent<SelectionActionsProps> = ({
  selection,
  onShare,
  onCopyLink,
  onDelete,
  onDownload,
  onMoveTo,
  onRename,
}) => {
  const [translate] = useTranslation();
  if (!selection) return null;
  return (
    <selection-actions>
      <ActionButton
        icon={ShareIcon}
        label={translate('oneDriveLayout.action.share', 'Share')}
        onClick={onShare}
      />
      <ActionButton
        icon={LinkIcon}
        label={translate('oneDriveLayout.action.link', 'Copy link')}
        onClick={onCopyLink}
      />
      <ActionButton
        icon={DeleteIcon}
        label={translate('oneDriveLayout.action.delete', 'Delete')}
        onClick={onDelete}
      />
      <ActionButton
        icon={DownloadIcon}
        label={translate('oneDriveLayout.action.download', 'Download')}
        onClick={onDownload}
      />
      <ActionButton
        icon={MoveToIcon}
        label={translate('oneDriveLayout.action.moveTo', 'Move to')}
        onClick={onMoveTo}
        stub
      />
      <ActionButton
        icon={RenameIcon}
        label={translate('oneDriveLayout.action.rename', 'Rename')}
        onClick={onRename}
        stub
      />
    </selection-actions>
  );
};

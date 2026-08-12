/**
 * Page-header action strip for the active selection: Share, Copy link,
 * Delete, Download, Move to (stub, #36), Rename (stub, #36).
 *
 * A {@link ResizeObserver} drives progressive overflow: actions that
 * don't fit inline spill into a kebab dropdown so the strip never
 * wraps. Renders nothing when `selection` is null.
 *
 * @packageDocumentation
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType, FunctionComponent, SVGProps } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useTranslation } from 'react-i18next';
import {
  ShareIcon,
  LinkIcon,
  DeleteIcon,
  DownloadIcon,
  MoveToIcon,
  RenameIcon,
  MoreHorizontalIcon,
  TrashIcon,
} from '@/features/onedrive-layout/icons';
import type { SelectedResource } from '@/features/onedrive-layout/hooks/useSelectedResource';

interface SelectionActionsProps {
  selection: SelectedResource;
  onShare: () => void;
  onCopyLink: () => void;
  // Moves a file to the Recycle Bin or hard-deletes a folder.
  onDelete: () => void;
  onDownload: () => void;
  onMoveTo: () => void;
  onRename: () => void;
}

interface ActionDef {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  onClick: () => void;
  stub?: boolean;
}

// Approximate width of a single action button, used to determine how many fit inline.
const ACTION_BUTTON_WIDTH = 110;
const KEBAB_WIDTH = 44;

const ActionButton: FunctionComponent<{ action: ActionDef }> = ({ action }) => (
  <button
    type="button"
    className="odl-toolbar-button"
    aria-label={action.label}
    onClick={action.onClick}
    {...(action.stub ? { 'data-stub': 'true' } : {})}
  >
    <action.Icon aria-hidden focusable={false} />
    <span>{action.label}</span>
  </button>
);

/**
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
  const containerRef = useRef<HTMLElement>(null);
  // Render all items inline until the first width measurement is available,
  // then re-render with overflow handling.
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Files move to the Recycle Bin, while folders are permanently deleted
  // because they are currently not catalog-backed and cannot be restored from trash.
  // TODO: add a catalog vocabulary for containers, linked via a parent container,
  // so folders become catalog-backed like files. That would make soft delete
  // and restore possible for folders too, instead of always hard-deleting them.
  const isFile = selection?.kind === 'file';
  const deleteLabel = isFile
    ? translate('oneDriveLayout.action.moveToTrash', 'Move to bin')
    : translate('oneDriveLayout.action.delete', 'Delete');
  const deleteIcon = isFile ? TrashIcon : DeleteIcon;

  const actions = useMemo<ActionDef[]>(
    () => [
      { Icon: ShareIcon,    label: translate('oneDriveLayout.action.share',    'Share'),     onClick: onShare },
      { Icon: LinkIcon,     label: translate('oneDriveLayout.action.link',     'Copy link'), onClick: onCopyLink },
      { Icon: deleteIcon,   label: deleteLabel,                                              onClick: onDelete },
      { Icon: DownloadIcon, label: translate('oneDriveLayout.action.download', 'Download'),  onClick: onDownload },
      { Icon: MoveToIcon,   label: translate('oneDriveLayout.action.moveTo',   'Move to'),   onClick: onMoveTo,   stub: true },
      { Icon: RenameIcon,   label: translate('oneDriveLayout.action.rename',   'Rename'),    onClick: onRename,   stub: true },
    ],
    [translate, onShare, onCopyLink, deleteIcon, deleteLabel, onDelete, onDownload, onMoveTo, onRename],
  );

  // Reserve KEBAB_WIDTH only when overflow is actually needed, so the
  // strip doesn't ditch a button just to make room for a kebab it
  // wouldn't show.
  const inlineCount = useMemo(() => {
    if (containerWidth === null) return actions.length;
    const fitsAll = containerWidth >= actions.length * ACTION_BUTTON_WIDTH;
    if (fitsAll) return actions.length;
    const usable = Math.max(0, containerWidth - KEBAB_WIDTH);
    return Math.max(0, Math.min(actions.length, Math.floor(usable / ACTION_BUTTON_WIDTH)));
  }, [containerWidth, actions.length]);

  const inlineActions = actions.slice(0, inlineCount);
  const overflowActions = actions.slice(inlineCount);
  const moreLabel = translate('oneDriveLayout.action.more', 'More actions');

  if (!selection) return null;

  return (
    <selection-actions ref={containerRef}>
      <selection-actions-inline>
        {inlineActions.map((action) => (
          <ActionButton key={action.label} action={action} />
        ))}
      </selection-actions-inline>

      {overflowActions.length > 0 && (
        <selection-actions-kebab>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="odl-selection-kebab"
                aria-label={moreLabel}
                title={moreLabel}
                data-overflow-count={overflowActions.length}
              >
                <MoreHorizontalIcon aria-hidden focusable={false} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="odl-toolbar-menu"
              >
                {overflowActions.map((action) => (
                  <DropdownMenu.Item
                    key={action.label}
                    className="odl-toolbar-menu__item"
                    onSelect={() => action.onClick()}
                    {...(action.stub ? { 'data-stub': 'true' } : {})}
                  >
                    <action.Icon aria-hidden focusable={false} />
                    <span>{action.label}</span>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </selection-actions-kebab>
      )}
    </selection-actions>
  );
};

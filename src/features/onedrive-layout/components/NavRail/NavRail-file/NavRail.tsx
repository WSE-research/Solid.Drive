/**
 * Left navigation pane for the OneDrive layout. Renders the icon-only
 * rail or the expanded pane based on `useNavRailExpanded`.
 *
 * @packageDocumentation
 */

import { useState } from 'react';
import type { ComponentType, FunctionComponent, SVGProps } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useTranslation } from 'react-i18next';
import {
  HomeIcon,
  MyFilesIcon,
  SharedIcon,
  RequestsIcon,
  PeopleIcon,
  HomeIconActive,
  MyFilesIconActive,
  SharedIconActive,
  RequestsIconActive,
  PeopleIconActive,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  NavRailCollapseIcon,
  NavRailExpandIcon,
} from '@/features/onedrive-layout/icons';
import {
  useViewParam,
  type ViewId,
} from '@/features/onedrive-layout/hooks/useViewParam';
import { useNavRailExpanded } from '@/features/onedrive-layout/hooks/useNavRailExpanded';
import { CreateMenu } from '@/features/onedrive-layout/components/CreateMenu';

type IconCmp = ComponentType<SVGProps<SVGSVGElement>>;

interface RailItem {
  id: ViewId;
  Icon: IconCmp;
  ActiveIcon: IconCmp;
  i18nKey: string;
}

const TOP_ITEMS: readonly RailItem[] = [
  { id: 'recent',   Icon: HomeIcon,    ActiveIcon: HomeIconActive,    i18nKey: 'oneDriveLayout.recent' },
  { id: 'my-files', Icon: MyFilesIcon, ActiveIcon: MyFilesIconActive, i18nKey: 'oneDriveLayout.myFiles' },
  { id: 'shared',   Icon: SharedIcon,  ActiveIcon: SharedIconActive,  i18nKey: 'oneDriveLayout.shared' },
];

const BOTTOM_ITEMS: readonly RailItem[] = [
  { id: 'requests', Icon: RequestsIcon, ActiveIcon: RequestsIconActive, i18nKey: 'oneDriveLayout.requests' },
  { id: 'people',   Icon: PeopleIcon,   ActiveIcon: PeopleIconActive,   i18nKey: 'oneDriveLayout.people' },
];

interface RailButtonProps {
  item: RailItem;
  active: boolean;
  expanded: boolean;
  onSelect: (id: ViewId) => void;
  label: string;
}

const RailButton: FunctionComponent<RailButtonProps> = ({
  item,
  active,
  expanded,
  onSelect,
  label,
}) => {
  const { Icon, ActiveIcon, id } = item;
  const Glyph = active ? ActiveIcon : Icon;
  const className = active ? 'rail-item rail-item--active' : 'rail-item';
  const ariaCurrent = active ? 'page' : undefined;
  const handleClick = () => onSelect(id);

  const button = (
    <button
      type="button"
      className={className}
      aria-current={ariaCurrent}
      aria-label={label}
      onClick={handleClick}
    >
      <Glyph aria-hidden focusable={false} />
      {expanded && <span className="rail-item__label">{label}</span>}
    </button>
  );

  // Tooltips only matter in the collapsed state where labels are not
  // visible. In expanded mode the label is already rendered next to
  // the icon, so a hover tooltip would be redundant.
  if (expanded) return button;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="right" sideOffset={8} className="rail-tooltip">
          {label}
          <Tooltip.Arrow className="rail-tooltip__arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
};

interface PaneToggleProps {
  expanded: boolean;
  onToggle: () => void;
  label: string;
}

const PaneToggle: FunctionComponent<PaneToggleProps> = ({ expanded, onToggle, label }) => {
  const Glyph = expanded ? NavRailCollapseIcon : NavRailExpandIcon;
  const button = (
    <button
      type="button"
      className="rail-pane-toggle"
      aria-label={label}
      aria-expanded={expanded}
      onClick={onToggle}
    >
      <Glyph aria-hidden focusable={false} />
    </button>
  );

  if (expanded) return button;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="right" sideOffset={8} className="rail-tooltip">
          {label}
          <Tooltip.Arrow className="rail-tooltip__arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
};

interface NavRailProps {
  /** Create menu "New folder" handler. */
  onNewFolder?: () => void;
  /** Create menu "Upload files" handler. */
  onFilesPicked?: (files: File[]) => void;
  /** Display name shown in the account header (expanded state only). */
  accountName?: string;
}

/**
 * Renders the rail. When both create callbacks are missing the `+`
 * button is rendered as a disabled fallback, so the rail can mount
 * in chrome-only contexts (Storybook, tests).
 *
 * @public
 */
export const NavRail: FunctionComponent<NavRailProps> = ({
  onNewFolder,
  onFilesPicked,
  accountName,
}) => {
  const [translate] = useTranslation();
  const [view, setView] = useViewParam();
  const [expanded, setExpanded] = useNavRailExpanded();
  const [browseOpen, setBrowseOpen] = useState(true);

  const createLabel = translate('oneDriveLayout.create', 'Create');
  const createFullLabel = translate('oneDriveLayout.createOrUpload', 'Create or upload');
  const paneToggleLabel = expanded
    ? translate('oneDriveLayout.navRailCollapse', 'Collapse')
    : translate('oneDriveLayout.navRailExpand', 'Expand');
  const browseLabel = translate('oneDriveLayout.browseFilesBy', 'Browse files by');

  const canCreate = Boolean(onNewFolder && onFilesPicked);

  const createControl = canCreate ? (
    <CreateMenu
      expanded={expanded}
      labelShort={createLabel}
      labelLong={createFullLabel}
      onNewFolder={onNewFolder!}
      onFilesPicked={onFilesPicked!}
    />
  ) : (
    <button
      type="button"
      className={expanded ? 'rail-create rail-create--expanded' : 'rail-create'}
      aria-label={expanded ? createFullLabel : createLabel}
      disabled
    >
      <PlusIcon aria-hidden focusable={false} />
      {expanded && <span className="rail-create__label">{createFullLabel}</span>}
    </button>
  );

  const renderTopItems = TOP_ITEMS.map((item) => (
    <RailButton
      key={item.id}
      item={item}
      active={view === item.id}
      expanded={expanded}
      onSelect={setView}
      label={translate(item.i18nKey)}
    />
  ));

  const renderBottomItems = BOTTOM_ITEMS.map((item) => (
    <RailButton
      key={item.id}
      item={item}
      active={view === item.id}
      expanded={expanded}
      onSelect={setView}
      label={translate(item.i18nKey)}
    />
  ));

  const toggleBrowse = () => setBrowseOpen((open) => !open);
  const togglePane = () => setExpanded(!expanded);

  return (
    <Tooltip.Provider delayDuration={300} skipDelayDuration={150}>
      <nav-rail
        aria-label={translate('oneDriveLayout.navRail', 'Navigation')}
        data-expanded={expanded ? 'true' : 'false'}
      >
        {createControl}

        {expanded ? (
          <rail-account-header>
            <span className="rail-account-name" title={accountName}>
              {accountName}
            </span>
            <PaneToggle expanded={expanded} onToggle={togglePane} label={paneToggleLabel} />
          </rail-account-header>
        ) : (
          <PaneToggle expanded={expanded} onToggle={togglePane} label={paneToggleLabel} />
        )}

        {renderTopItems}

        {expanded ? (
          <button
            type="button"
            className="rail-browse-header"
            aria-expanded={browseOpen}
            aria-controls="rail-bottom-panel"
            onClick={toggleBrowse}
          >
            <span className="rail-browse-header__label">{browseLabel}</span>
            {browseOpen ? (
              <ChevronDownIcon aria-hidden focusable={false} />
            ) : (
              <ChevronUpIcon aria-hidden focusable={false} />
            )}
          </button>
        ) : (
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                className="rail-divider-toggle"
                aria-expanded={browseOpen}
                aria-controls="rail-bottom-panel"
                aria-label={browseLabel}
                onClick={toggleBrowse}
              >
                {browseOpen ? (
                  <ChevronDownIcon aria-hidden focusable={false} />
                ) : (
                  <ChevronUpIcon aria-hidden focusable={false} />
                )}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content side="right" sideOffset={8} className="rail-tooltip">
                {browseLabel}
                <Tooltip.Arrow className="rail-tooltip__arrow" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        )}

        {browseOpen && (
          <rail-bottom-panel id="rail-bottom-panel">{renderBottomItems}</rail-bottom-panel>
        )}
      </nav-rail>
    </Tooltip.Provider>
  );
};

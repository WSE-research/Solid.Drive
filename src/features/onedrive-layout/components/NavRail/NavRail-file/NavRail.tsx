/**
 * Left-edge navigation rail for the OneDrive-inspired layout. Renders
 * the Create button, three top view items, a chevron divider, and the
 * bottom items. Each item wraps a Radix Tooltip with its localized
 * label.
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
} from '@/features/onedrive-layout/icons';
import {
  useViewParam,
  type ViewId,
} from '@/features/onedrive-layout/hooks/useViewParam';
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
  onSelect: (id: ViewId) => void;
  label: string;
}

const RailButton: FunctionComponent<RailButtonProps> = ({ item, active, onSelect, label }) => {
  const { Icon, ActiveIcon, id } = item;
  const Glyph = active ? ActiveIcon : Icon;
  const className = active ? 'rail-item rail-item--active' : 'rail-item';
  const ariaCurrent = active ? 'page' : undefined;
  const handleClick = () => onSelect(id);

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          className={className}
          aria-current={ariaCurrent}
          aria-label={label}
          onClick={handleClick}
        >
          <Glyph aria-hidden focusable={false} />
        </button>
      </Tooltip.Trigger>
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
  onNewFolder?: () => void;
  onFilesPicked?: (files: File[]) => void;
}

/**
 * Renders the navigation rail with logo, create button, and view switchers.
 * Both create callbacks are optional so the rail can render in chrome-only
 * contexts (early shells, storybooks, tests). The CreateMenu only renders
 * when both callbacks are wired; otherwise a disabled fallback button is
 * shown so the layout slot stays visually balanced.
 *
 * @public
 */
export const NavRail: FunctionComponent<NavRailProps> = ({
  onNewFolder,
  onFilesPicked,
}) => {
  const [translate] = useTranslation();
  const [view, setView] = useViewParam();
  // The chevron at the bottom of the rail toggles a panel that holds
  // the Requests + People view switchers. The user owns this state
  // entirely — even when they're currently on Requests or People,
  // they can collapse the panel.
  const [bottomVisible, setBottomVisible] = useState(true);

  return (
    <Tooltip.Provider delayDuration={300} skipDelayDuration={150}>
      <nav-rail aria-label={translate('oneDriveLayout.navRail', 'Navigation')}>
        {onNewFolder && onFilesPicked ? (
          <CreateMenu onNewFolder={onNewFolder} onFilesPicked={onFilesPicked} />
        ) : (
          <button
            type="button"
            className="rail-create"
            aria-label={translate('oneDriveLayout.create', 'Create')}
            disabled
          >
            <PlusIcon aria-hidden focusable={false} />
          </button>
        )}

        {TOP_ITEMS.map((item) => (
          <RailButton
            key={item.id}
            item={item}
            active={view === item.id}
            onSelect={setView}
            label={translate(item.i18nKey)}
          />
        ))}

        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              type="button"
              className="rail-divider-toggle"
              aria-expanded={bottomVisible}
              aria-controls="rail-bottom-panel"
              aria-label={
                bottomVisible
                  ? translate('oneDriveLayout.navRailCollapse', 'Collapse')
                  : translate('oneDriveLayout.navRailExpand', 'Expand')
              }
              onClick={() => setBottomVisible((open: boolean) => !open)}
            >
              {bottomVisible ? (
                <ChevronDownIcon aria-hidden focusable={false} />
              ) : (
                <ChevronUpIcon aria-hidden focusable={false} />
              )}
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content side="right" sideOffset={8} className="rail-tooltip">
              {bottomVisible
                ? translate('oneDriveLayout.navRailCollapse', 'Collapse')
                : translate('oneDriveLayout.navRailExpand', 'Expand')}
              <Tooltip.Arrow className="rail-tooltip__arrow" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>

        {bottomVisible && (
          <rail-bottom-panel id="rail-bottom-panel">
            {BOTTOM_ITEMS.map((item) => (
              <RailButton
                key={item.id}
                item={item}
                active={view === item.id}
                onSelect={setView}
                label={translate(item.i18nKey)}
              />
            ))}
          </rail-bottom-panel>
        )}
      </nav-rail>
    </Tooltip.Provider>
  );
};

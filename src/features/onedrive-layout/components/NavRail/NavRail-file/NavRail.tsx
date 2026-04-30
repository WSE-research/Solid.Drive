/**
 * Left-edge navigation rail for the OneDrive-inspired layout.
 * Renders the Create (+) button, the 5 top view items, a chevron divider,
 * and the People item at the bottom. Each item wraps a Radix Tooltip that
 * surfaces its localized EN / DE label.
 *
 * @packageDocumentation
 */

import type { ComponentType, FunctionComponent, SVGProps } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useTranslation } from 'react-i18next';
import {
  HomeIcon,
  MyFilesIcon,
  SharedIcon,
  RequestsIcon,
  BinIcon,
  PeopleIcon,
  HomeIconActive,
  MyFilesIconActive,
  SharedIconActive,
  RequestsIconActive,
  BinIconActive,
  PeopleIconActive,
  ChevronDownIcon,
  PlusIcon,
} from '@/features/onedrive-layout/icons';
import {
  useViewParam,
  type ViewId,
} from '@/features/onedrive-layout/hooks/useViewParam';

type IconCmp = ComponentType<SVGProps<SVGSVGElement>>;

interface RailItem {
  id: ViewId;
  Icon: IconCmp;
  ActiveIcon: IconCmp;
  i18nKey: string;
}

const TOP_ITEMS: readonly RailItem[] = [
  { id: 'recent',   Icon: HomeIcon,     ActiveIcon: HomeIconActive,     i18nKey: 'oneDriveLayout.recent' },
  { id: 'my-files', Icon: MyFilesIcon,  ActiveIcon: MyFilesIconActive,  i18nKey: 'oneDriveLayout.myFiles' },
  { id: 'shared',   Icon: SharedIcon,   ActiveIcon: SharedIconActive,   i18nKey: 'oneDriveLayout.shared' },
  { id: 'requests', Icon: RequestsIcon, ActiveIcon: RequestsIconActive, i18nKey: 'oneDriveLayout.requests' },
  { id: 'bin',      Icon: BinIcon,      ActiveIcon: BinIconActive,      i18nKey: 'oneDriveLayout.bin' },
];

const PEOPLE_ITEM: RailItem = {
  id: 'people',
  Icon: PeopleIcon,
  ActiveIcon: PeopleIconActive,
  i18nKey: 'oneDriveLayout.people',
};

interface RailButtonProps {
  item: RailItem;
  active: boolean;
  onSelect: (id: ViewId) => void;
  label: string;
}

const RailButton: FunctionComponent<RailButtonProps> = ({ item, active, onSelect, label }) => {
  const { Icon, ActiveIcon, id } = item;
  const Glyph = active ? ActiveIcon : Icon;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          className={`rail-item${active ? ' rail-item--active' : ''}`}
          aria-current={active ? 'page' : undefined}
          aria-label={label}
          onClick={() => onSelect(id)}
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

/**
 * Renders the navigation rail with logo, create button, and view switchers.
 *
 * @public
 */
export const NavRail: FunctionComponent = () => {
  const [translate] = useTranslation();
  const [view, setView] = useViewParam();

  return (
    <Tooltip.Provider delayDuration={300} skipDelayDuration={150}>
      <nav-rail aria-label={translate('oneDriveLayout.navRail', 'Navigation')}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              type="button"
              className="rail-create"
              aria-label={translate('oneDriveLayout.create', 'Create')}
            >
              <PlusIcon aria-hidden focusable={false} />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content side="right" sideOffset={8} className="rail-tooltip">
              {translate('oneDriveLayout.create', 'Create')}
              <Tooltip.Arrow className="rail-tooltip__arrow" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>

        {TOP_ITEMS.map((item) => (
          <RailButton
            key={item.id}
            item={item}
            active={view === item.id}
            onSelect={setView}
            label={translate(item.i18nKey)}
          />
        ))}

        <ChevronDownIcon
          className="rail-divider"
          aria-hidden
          focusable={false}
        />

        <RailButton
          item={PEOPLE_ITEM}
          active={view === 'people'}
          onSelect={setView}
          label={translate(PEOPLE_ITEM.i18nKey)}
        />
      </nav-rail>
    </Tooltip.Provider>
  );
};

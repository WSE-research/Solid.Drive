/**
 * Collapsed variant of {@link TypeFilterChips} for medium viewports —
 * one "All ▼" trigger that opens a Radix DropdownMenu listing every
 * chip as a checkbox item. Used between the wide-layout (full chip
 * row) and narrow-layout (icon-only chips) breakpoints, when there is
 * still some toolbar space but not enough for inline chip text.
 *
 * Both representations mount simultaneously; CSS media queries decide
 * which one is visible. Selection state is shared via the same props
 * so toggling in either UI updates the other.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon, CheckmarkIcon } from '@/features/onedrive-layout/icons';
import type { FilterChipDef } from './chipCatalog';

/**
 * Props for {@link TypeFilterChipsDropdown}.
 *
 * @public
 */
export interface TypeFilterChipsDropdownProps {
  chips: readonly FilterChipDef[];
  selected: ReadonlySet<string>;
  onToggle: (chipId: string) => void;
  onReset: () => void;
}

/**
 * Renders the collapsed dropdown chip selector.
 *
 * @public
 */
export const TypeFilterChipsDropdown: FunctionComponent<TypeFilterChipsDropdownProps> = ({
  chips,
  selected,
  onToggle,
  onReset,
}) => {
  const [translate] = useTranslation();
  const allActive = selected.size === 0;

  // Clicking an item replaces the active chip (single-select). We
  // preventDefault so the menu stays open while the user explores
  // filter options — closing on every click is jarring when the user
  // is comparing chips.
  const handleSelectAll = (event: Event) => {
    event.preventDefault();
    onReset();
  };
  const handleToggle = (chipId: string) => (event: Event) => {
    event.preventDefault();
    onToggle(chipId);
  };

  return (
    <type-filter-chips-dropdown>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className={`odl-filter-chip odl-filter-chip--dropdown${
              allActive ? ' odl-filter-chip--active' : ''
            }`}
            aria-label={translate('oneDriveLayout.filters.typeGroup', 'File type filter')}
          >
            <span className="odl-filter-chip__label">
              {translate('oneDriveLayout.filters.allTypes', 'All')}
            </span>
            <ChevronDownIcon aria-hidden focusable={false} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="odl-toolbar-menu"
            align="start"
            sideOffset={6}
          >
            <DropdownMenu.CheckboxItem
              checked={allActive}
              onSelect={handleSelectAll}
              className="odl-toolbar-menu__item"
            >
              <DropdownMenu.ItemIndicator className="odl-toolbar-menu__indicator">
                <CheckmarkIcon aria-hidden focusable={false} />
              </DropdownMenu.ItemIndicator>
              <span className="odl-filter-chip__label">
                {translate('oneDriveLayout.filters.allTypes', 'All')}
              </span>
            </DropdownMenu.CheckboxItem>
            {chips.map((chip) => (
              <DropdownMenu.CheckboxItem
                key={chip.id}
                checked={selected.has(chip.id)}
                onSelect={handleToggle(chip.id)}
                className="odl-toolbar-menu__item"
              >
                <DropdownMenu.ItemIndicator className="odl-toolbar-menu__indicator">
                  <CheckmarkIcon aria-hidden focusable={false} />
                </DropdownMenu.ItemIndicator>
                <span className="odl-filter-chip__icon" aria-hidden>
                  <chip.Icon />
                </span>
                <span className="odl-filter-chip__label">{chip.label}</span>
              </DropdownMenu.CheckboxItem>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </type-filter-chips-dropdown>
  );
};

/**
 * Right-zone toolbar above the My Files table. Hosts the Sort dropdown
 * and the Details toggle. Stateless: every interaction is forwarded
 * through the matching callback prop.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useTranslation } from 'react-i18next';
import {
  SortIcon,
  DetailsPanelIcon,
  DetailsPanelIconActive,
  CheckmarkIcon,
} from '@/features/onedrive-layout/icons';
import type { SortKey, SortState } from '@/features/onedrive-layout/hooks/useMyFilesSort';

const SORT_KEYS: readonly SortKey[] = ['name', 'modified', 'size', 'sharing'];

interface ContextualToolbarProps {
  sort: SortState;
  onSortChange: (next: SortState) => void;
  detailsOpen: boolean;
  onToggleDetails: () => void;
}

/**
 * @public
 */
export const ContextualToolbar: FunctionComponent<ContextualToolbarProps> = ({
  sort,
  onSortChange,
  detailsOpen,
  onToggleDetails,
}) => {
  const [translate] = useTranslation();

  const handleSortSelect = (key: SortKey) => {
    if (key === sort.key) {
      onSortChange({
        key,
        direction: sort.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      onSortChange({ key, direction: 'asc' });
    }
  };

  return (
    <contextual-toolbar>
      <toolbar-right>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="odl-toolbar-button"
              aria-label={translate('oneDriveLayout.toolbar.sort', 'Sort')}
            >
              <SortIcon aria-hidden focusable={false} />
              <span>{translate('oneDriveLayout.toolbar.sort', 'Sort')}</span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="odl-toolbar-menu"
            >
              <DropdownMenu.RadioGroup value={sort.key}>
                {SORT_KEYS.map((key) => (
                  <DropdownMenu.RadioItem
                    key={key}
                    value={key}
                    className="odl-toolbar-menu__item"
                    onSelect={(event) => {
                      event.preventDefault();
                      handleSortSelect(key);
                    }}
                  >
                    <DropdownMenu.ItemIndicator className="odl-toolbar-menu__indicator">
                      <CheckmarkIcon aria-hidden focusable={false} />
                    </DropdownMenu.ItemIndicator>
                    {translate(`oneDriveLayout.sort.${key}`, key)}
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <button
          type="button"
          className="odl-toolbar-button"
          aria-label={translate('oneDriveLayout.toolbar.details', 'Details')}
          aria-pressed={detailsOpen}
          onClick={onToggleDetails}
        >
          {detailsOpen ? (
            <DetailsPanelIconActive aria-hidden focusable={false} />
          ) : (
            <DetailsPanelIcon aria-hidden focusable={false} />
          )}
          <span>{translate('oneDriveLayout.toolbar.details', 'Details')}</span>
        </button>
      </toolbar-right>
    </contextual-toolbar>
  );
};

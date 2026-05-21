/**
 * Gear-icon dropdown in the OneDrive topbar.
 * Hosts the language radio group, the theme select, and the layout toggle.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useTranslation } from 'react-i18next';
import { GearIcon, CheckmarkIcon } from '@/features/onedrive-layout/icons';
import { LayoutToggle } from '@/features/onedrive-layout/components/LayoutToggle';
import { ThemeToggle } from '@/features/onedrive-layout/components/ThemeToggle';
import { SUPPORTED_LANGUAGES } from '@/config';

/**
 * Renders the gear-icon Settings dropdown.
 *
 * @public
 */
export const SettingsMenu: FunctionComponent = () => {
  const [translate, i18n] = useTranslation();

  const handleLanguageChange = (next: string) => i18n.changeLanguage(next);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="topbar-icon"
          aria-label={translate('oneDriveLayout.settings', 'Settings')}
        >
          <GearIcon aria-hidden focusable={false} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="topbar-menu"
        >
          <DropdownMenu.Label className="topbar-menu__label">
            {translate('languageSwitcher.label', 'Language')}
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={i18n.resolvedLanguage}
            onValueChange={handleLanguageChange}
          >
            {SUPPORTED_LANGUAGES.map((language) => (
              <DropdownMenu.RadioItem
                key={language.code}
                value={language.code}
                className="topbar-menu__item topbar-menu__item--radio"
              >
                <DropdownMenu.ItemIndicator className="topbar-menu__indicator">
                  <CheckmarkIcon aria-hidden focusable={false} />
                </DropdownMenu.ItemIndicator>
                {language.label}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>

          <DropdownMenu.Separator className="topbar-menu__separator" />

          <DropdownMenu.Label className="topbar-menu__label">
            {translate('oneDriveLayout.theme', 'Theme')}
          </DropdownMenu.Label>
          <topbar-menu-row>
            <ThemeToggle />
          </topbar-menu-row>

          <DropdownMenu.Separator className="topbar-menu__separator" />

          <DropdownMenu.Label className="topbar-menu__label">
            {translate('oneDriveLayout.layout', 'Layout')}
          </DropdownMenu.Label>
          <topbar-menu-row>
            <LayoutToggle />
          </topbar-menu-row>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

/**
 * Sticky top bar for the OneDrive inspired layout.
 * Hosts the search input, a Settings dropdown (language + layout switch),
 * and an avatar dropdown that surfaces the signed-in profile (name, WebID,
 * View profile link, Log out).
 *
 * @packageDocumentation
 */

import type { ChangeEvent, FunctionComponent } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useResource, useSolidAuth, useSubject } from '@ldo/solid-react';
import { useTranslation } from 'react-i18next';
import { SolidProfileShapeType } from '@/.ldo/solidProfile.shapeTypes';
import { Avatar } from '@/shared/components/Avatar';
import { getInitial } from '@/shared/utils/getInitial';
import { getProfileDisplayName } from '@/shared/utils/getProfileDisplayName';
import {
  GearIcon,
  CheckmarkIcon,
} from '@/features/onedrive-layout/icons';
import { LayoutToggle } from '@/features/onedrive-layout/components/LayoutToggle';
import { SUPPORTED_LANGUAGES } from '@/config';
import logoUrl from '@/assets/solid-drive-logo.png';

interface TopBarProps {
  searchValue: string;
  onSearchChange: (next: string) => void;
}

/**
 * Renders the OneDrive style top bar.
 *
 * @public
 */
export const TopBar: FunctionComponent<TopBarProps> = ({
  searchValue,
  onSearchChange,
}) => {
  const [translate, i18n] = useTranslation();
  const { session, logout } = useSolidAuth();

  void useResource(session.webId);
  const profile = useSubject(SolidProfileShapeType, session.webId);

  const webId = session.webId ?? '';

  const profileName = getProfileDisplayName(profile, webId);
  const avatarSrc = profile?.img?.['@id'];
  
  const displayName = profileName || translate('oneDriveLayout.signedIn', 'Signed in');
  const avatarAlt = profileName || translate('oneDriveLayout.account', 'Account');
  const initial = getInitial(profileName);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) =>
    onSearchChange(event.target.value);

  const handleLanguageChange = (next: string) => i18n.changeLanguage(next);

  return (
    <top-bar>
      <topbar-brand>
        <img src={logoUrl} alt="Solid.drive" className="topbar-logo" />
      </topbar-brand>

      <search-slot>
        <input
          type="search"
          value={searchValue}
          onChange={handleSearchChange}
          placeholder={translate('oneDriveLayout.searchPlaceholder', 'Search')}
          aria-label={translate('oneDriveLayout.searchPlaceholder', 'Search')}
          className="topbar-search"
        />
      </search-slot>

      <topbar-actions>

      {/* Settings dropdown: language switcher + layout toggle */}
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
              {translate('oneDriveLayout.layout', 'Layout')}
            </DropdownMenu.Label>
            <topbar-menu-row>
              <LayoutToggle />
            </topbar-menu-row>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Avatar dropdown: profile header + View profile + Log out */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="topbar-avatar"
            aria-label={translate('oneDriveLayout.account', 'Account')}
          >
            <Avatar size="sm" src={avatarSrc} alt={avatarAlt} initial={initial} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="topbar-menu topbar-menu--account"
          >
            <topbar-menu-profile>
              <Avatar size="md" src={avatarSrc} alt={avatarAlt} initial={initial} />
              <topbar-menu-profile-info>
                <topbar-menu-profile-name>{displayName}</topbar-menu-profile-name>
                {webId && (
                  <topbar-menu-profile-webid title={webId}>
                    {webId}
                  </topbar-menu-profile-webid>
                )}
              </topbar-menu-profile-info>
            </topbar-menu-profile>

            {webId && (
              <>
                <DropdownMenu.Separator className="topbar-menu__separator" />
                <DropdownMenu.Item
                  asChild
                  className="topbar-menu__item topbar-menu__item--link"
                >
                  <a href={webId} target="_blank" rel="noopener noreferrer">
                    {translate('oneDriveLayout.viewProfile', 'View profile')}
                  </a>
                </DropdownMenu.Item>
              </>
            )}

            <DropdownMenu.Separator className="topbar-menu__separator" />

            <DropdownMenu.Item
              className="topbar-menu__item topbar-menu__item--destructive"
              onSelect={() => logout()}
            >
              {translate('oneDriveLayout.logout', 'Log out')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      </topbar-actions>
    </top-bar>
  );
};

/**
 * Sticky top bar for the OneDrive inspired layout.
 * Hosts the search input, a Settings dropdown (language, theme, and layout
 * toggles), and an avatar dropdown that surfaces the signed-in profile name,
 * WebID, a View profile link, and a Log out action.
 *
 * The centered search input collapses to an icon button at narrow
 * viewports via CSS. Clicking the icon expands a full-width overlay
 * search bar that replaces the topbar content until the user either
 * dismisses it with the close button or Escape, or blurs the input.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FunctionComponent, KeyboardEvent } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useSolidAuth } from '@ldo/solid-react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/shared/components/Avatar';
import { getInitial } from '@/shared/utils/getInitial';
import { GearIcon, CheckmarkIcon, SearchIcon, CloseIcon } from '@/features/onedrive-layout/icons';
import { LayoutToggle } from '@/features/onedrive-layout/components/LayoutToggle';
import { ThemeToggle } from '@/features/onedrive-layout/components/ThemeToggle';
import { SUPPORTED_LANGUAGES } from '@/config';
import logoUrl from '@/assets/solid-drive-logo.png';

interface TopBarProps {
  searchValue: string;
  onSearchChange: (next: string) => void;
  webId: string;
  profileName: string;
  avatarSrc: string | undefined;
}

/**
 * Renders the OneDrive style top bar.
 *
 * @public
 */
export const TopBar: FunctionComponent<TopBarProps> = ({
  searchValue,
  onSearchChange,
  webId,
  profileName,
  avatarSrc,
}) => {
  const [translate, i18n] = useTranslation();
  const { logout } = useSolidAuth();

  const displayName = profileName || translate('oneDriveLayout.signedIn', 'Signed in');
  const avatarAlt = profileName || translate('oneDriveLayout.account', 'Account');
  const initial = getInitial(profileName);

  const [searchExpanded, setSearchExpanded] = useState(false);
  const overlayInputRef = useRef<HTMLInputElement | null>(null);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) =>
    onSearchChange(event.target.value);
  const handleLanguageChange = (next: string) => i18n.changeLanguage(next);

  const openSearch = useCallback(() => setSearchExpanded(true), []);
  const closeSearch = useCallback(() => setSearchExpanded(false), []);

  useEffect(() => {
    if (!searchExpanded) return;
    overlayInputRef.current?.focus();
  }, [searchExpanded]);

  const handleOverlayKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSearch();
    }
  };

  const searchPlaceholder = translate('oneDriveLayout.searchPlaceholder', 'Search');

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
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="topbar-search"
        />
      </search-slot>

      <topbar-actions>

      {/* Hidden on wide viewports via CSS; opens the full-width overlay below. */}
      <button
        type="button"
        className="topbar-icon topbar-search-trigger"
        aria-label={searchPlaceholder}
        onClick={openSearch}
      >
        <SearchIcon aria-hidden focusable={false} />
      </button>

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

      {/* Shares state with the centered search input, so the typed query persists when it closes. */}
      {searchExpanded && (
        <topbar-search-overlay role="search" data-testid="topbar-search-overlay">
          <span className="topbar-search-overlay__icon" aria-hidden>
            <SearchIcon />
          </span>
          <input
            ref={overlayInputRef}
            type="search"
            value={searchValue}
            onChange={handleSearchChange}
            onKeyDown={handleOverlayKeyDown}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="topbar-search-overlay__input"
          />
          <button
            type="button"
            className="topbar-icon topbar-search-overlay__close"
            aria-label={translate('oneDriveLayout.details.close', 'Close')}
            onClick={closeSearch}
          >
            <CloseIcon aria-hidden focusable={false} />
          </button>
        </topbar-search-overlay>
      )}
    </top-bar>
  );
};

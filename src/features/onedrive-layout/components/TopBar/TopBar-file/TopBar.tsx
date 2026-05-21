/**
 * Sticky top bar for the OneDrive inspired layout.
 * Hosts the search input plus two dropdowns: SettingsMenu (language,
 * theme, layout) and AccountMenu (profile, view profile, log out).
 *
 * The centered search input collapses to an icon button at narrow
 * viewports via CSS. Clicking the icon expands a full-width overlay
 * search bar that replaces the topbar content until the user either
 * dismisses it with the close button or Escape, or blurs the input.
 *
 * @packageDocumentation
 */

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FunctionComponent, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIcon, CloseIcon } from '@/features/onedrive-layout/icons';
import { SettingsMenu } from '@/features/onedrive-layout/components/SettingsMenu';
import { AccountMenu } from '@/features/onedrive-layout/components/AccountMenu';
import logoUrl from '@/assets/solid-drive-logo.png';

interface TopBarProps {
  searchValue: string;
  onSearchChange: (next: string) => void;
  webId: string;
  profileName: string;
  avatarSrc?: string;
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
  const [translate] = useTranslation();
  const [searchExpanded, setSearchExpanded] = useState(false);
  const overlayInputRef = useRef<HTMLInputElement | null>(null);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) =>
    onSearchChange(event.target.value);
  const openSearch = () => setSearchExpanded(true);
  const closeSearch = () => setSearchExpanded(false);
  const handleOverlayKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSearch();
    }
  };

  useEffect(() => {
    if (!searchExpanded) return;
    overlayInputRef.current?.focus();
  }, [searchExpanded]);

  const searchPlaceholder = translate('oneDriveLayout.searchPlaceholder', 'Search');
  const closeLabel = translate('oneDriveLayout.details.close', 'Close');

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
        <button
          type="button"
          className="topbar-icon topbar-search-trigger"
          aria-label={searchPlaceholder}
          onClick={openSearch}
        >
          <SearchIcon aria-hidden focusable={false} />
        </button>
        <SettingsMenu />
        <AccountMenu webId={webId} profileName={profileName} avatarSrc={avatarSrc} />
      </topbar-actions>

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
            aria-label={closeLabel}
            onClick={closeSearch}
          >
            <CloseIcon aria-hidden focusable={false} />
          </button>
        </topbar-search-overlay>
      )}
    </top-bar>
  );
};

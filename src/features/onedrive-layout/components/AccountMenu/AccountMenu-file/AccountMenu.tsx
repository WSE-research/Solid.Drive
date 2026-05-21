/**
 * Avatar dropdown in the OneDrive topbar.
 * Surfaces the signed-in profile name, the WebID, a View profile link,
 * and a Log out action.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useSolidAuth } from '@ldo/solid-react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/shared/components/Avatar';
import { getInitial } from '@/shared/utils/getInitial';

interface AccountMenuProps {
  webId: string;
  profileName: string;
  avatarSrc?: string;
}

/**
 * Renders the avatar-triggered Account dropdown.
 *
 * @public
 */
export const AccountMenu: FunctionComponent<AccountMenuProps> = ({
  webId,
  profileName,
  avatarSrc,
}) => {
  const [translate] = useTranslation();
  const { logout } = useSolidAuth();

  const displayName = profileName || translate('oneDriveLayout.signedIn', 'Signed in');
  const avatarAlt = profileName || translate('oneDriveLayout.account', 'Account');
  const initial = getInitial(profileName);

  return (
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
  );
};

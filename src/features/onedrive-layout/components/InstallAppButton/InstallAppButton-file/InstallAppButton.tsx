/**
 * Topbar control that installs Solid.drive as a desktop PWA.
 *
 * Renders nothing until the browser has offered an install prompt and
 * the app is not already installed, so the icon only appears when
 * clicking it can actually do something. Clicking replays the native
 * install prompt captured by {@link usePwaInstall}.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { InstallIcon } from '@/features/onedrive-layout/icons';
import { usePwaInstall } from '@/shared/hooks/usePwaInstall';

/**
 * Renders the "Install app" topbar icon button when installable.
 *
 * @public
 */
export const InstallAppButton: FunctionComponent = () => {
  const [translate] = useTranslation();
  const { canInstall, promptInstall } = usePwaInstall();

  if (!canInstall) return null;

  const label = translate('oneDriveLayout.installApp', 'Install app');

  return (
    <button
      type="button"
      className="topbar-icon"
      aria-label={label}
      title={label}
      data-testid="install-app-button"
      onClick={() => {
        void promptInstall();
      }}
    >
      <InstallIcon aria-hidden focusable={false} />
    </button>
  );
};

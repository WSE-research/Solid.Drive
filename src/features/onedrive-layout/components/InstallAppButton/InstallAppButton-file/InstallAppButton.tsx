/**
 * "Install app" control. Renders only while the browser is offering a
 * PWA install (and the app is not already installed), and opens the
 * native install prompt on click.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { InstallIcon } from '@/features/onedrive-layout/icons';
import { usePwaInstall } from '@/shared/hooks/usePwaInstall';
import './InstallAppButton.css';

/**
 * Renders the install pill when {@link usePwaInstall} reports the app
 * can be installed; otherwise renders nothing.
 *
 * @public
 */
export const InstallAppButton: FunctionComponent = () => {
  const [translate] = useTranslation();
  const { canInstall, promptInstall } = usePwaInstall();

  if (!canInstall) return null;

  const label = translate('pwa.install', 'Install app');
  const handleClick = () => {
    void promptInstall();
  };

  return (
    <button
      type="button"
      className="install-app-button"
      onClick={handleClick}
      aria-label={label}
    >
      <InstallIcon aria-hidden focusable={false} />
      <span className="install-app-button__label">{label}</span>
    </button>
  );
};

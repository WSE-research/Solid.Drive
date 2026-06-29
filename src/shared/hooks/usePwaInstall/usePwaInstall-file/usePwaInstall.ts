/**
 * Captures the browser's deferred PWA install prompt and exposes a
 * small surface for an "Install app" control: whether installation is
 * currently offered, whether the app already runs installed, and a
 * function that opens the native prompt and resolves with the outcome.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useState } from 'react';

/**
 * The non-standard `beforeinstallprompt` event fired by Chromium
 * browsers. Typed locally because it is absent from the DOM lib.
 *
 * @public
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt: () => Promise<void>;
}

/**
 * Outcome of {@link PwaInstall.promptInstall}. `unavailable` means no
 * deferred prompt was held, so the native dialog never opened.
 *
 * @public
 */
export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

/**
 * Install surface returned by {@link usePwaInstall}.
 *
 * @public
 */
export interface PwaInstall {
  canInstall: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<InstallOutcome>;
}

const isRunningStandalone = (): boolean => {
  const matchesStandalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return matchesStandalone || iosStandalone;
};

/**
 * Tracks PWA installability via the `beforeinstallprompt` and
 * `appinstalled` window events. The control should render only when
 * {@link PwaInstall.canInstall} is true.
 *
 * @public
 */
export const usePwaInstall = (): PwaInstall => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(isRunningStandalone);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (!deferredPrompt) return 'unavailable';
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (outcome === 'accepted') setIsInstalled(true);
      return outcome;
    } catch {
      return 'unavailable';
    }
  }, [deferredPrompt]);

  return {
    canInstall: deferredPrompt !== null,
    isInstalled,
    promptInstall,
  };
};

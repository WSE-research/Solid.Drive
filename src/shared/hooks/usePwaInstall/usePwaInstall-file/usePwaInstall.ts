/**
 * Hook that wires up the desktop PWA install flow.
 *
 * Captures the browser's `beforeinstallprompt` event so the app can
 * surface its own "Install app" affordance, replays the prompt on
 * demand, and tracks whether the app is already running installed
 * (standalone) so the affordance can hide itself.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useState } from 'react';

/**
 * The non-standard event Chromium fires when an app meets the install
 * criteria. Not in the DOM lib typings, so it is declared here.
 *
 * @public
 */
export interface BeforeInstallPromptEvent extends Event {
  /** Platforms the prompt can target (e.g. `"web"`). */
  readonly platforms: string[];
  /** Shows the native install prompt. Usable once per captured event. */
  prompt: () => Promise<void>;
  /** Resolves with the user's decision after {@link BeforeInstallPromptEvent.prompt}. */
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/**
 * Return shape of {@link usePwaInstall}.
 *
 * @public
 */
export interface PwaInstall {
  /** True when a captured prompt is available and the app is not installed. */
  canInstall: boolean;
  /** True when the app is already running as an installed/standalone app. */
  isInstalled: boolean;
  /**
   * Replays the captured install prompt. Resolves to the user's choice,
   * or `null` when no prompt is available.
   */
  promptInstall: () => Promise<'accepted' | 'dismissed' | null>;
}

/**
 * Reports whether the document is being displayed as an installed app.
 * Covers both the standard `display-mode: standalone` media query and
 * iOS Safari's legacy `navigator.standalone` flag.
 *
 * @public
 */
export const isStandaloneDisplayMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  const standaloneMatch = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return standaloneMatch || iosStandalone;
};

/**
 * Tracks PWA installability and exposes a way to trigger the native
 * install prompt.
 *
 * @public
 */
export const usePwaInstall = (): PwaInstall => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(isStandaloneDisplayMode);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      // Suppress Chromium's default mini-infobar; the app drives the prompt.
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | null> => {
    if (!deferredPrompt) return null;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // A captured prompt may only be replayed once.
    setDeferredPrompt(null);
    return outcome;
  }, [deferredPrompt]);

  return {
    canInstall: deferredPrompt !== null && !isInstalled,
    isInstalled,
    promptInstall,
  };
};

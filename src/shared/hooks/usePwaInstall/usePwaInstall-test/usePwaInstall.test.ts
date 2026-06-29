import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePwaInstall, type BeforeInstallPromptEvent } from '../usePwaInstall-file/usePwaInstall';

type Outcome = 'accepted' | 'dismissed';

const makeInstallPromptEvent = (outcome: Outcome): BeforeInstallPromptEvent => {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: Outcome; platform: string }>;
    platforms: string[];
  };
  event.platforms = ['web'];
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome, platform: 'web' });
  return event as BeforeInstallPromptEvent;
};

const fireBeforeInstallPrompt = (event: BeforeInstallPromptEvent) =>
  act(() => {
    window.dispatchEvent(event);
  });

describe('usePwaInstall', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it('reports not installable before any prompt event', () => {
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.canInstall).toBe(false);
    expect(result.current.isInstalled).toBe(false);
  });

  it('becomes installable after beforeinstallprompt and prevents the default mini-infobar', () => {
    const { result } = renderHook(() => usePwaInstall());
    const event = makeInstallPromptEvent('accepted');
    const preventDefault = vi.spyOn(event, 'preventDefault');

    fireBeforeInstallPrompt(event);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(result.current.canInstall).toBe(true);
  });

  it('promptInstall returns "unavailable" when no prompt was captured', async () => {
    const { result } = renderHook(() => usePwaInstall());
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });
    expect(outcome).toBe('unavailable');
  });

  it('opens the native prompt and marks the app installed when accepted', async () => {
    const { result } = renderHook(() => usePwaInstall());
    const event = makeInstallPromptEvent('accepted');
    fireBeforeInstallPrompt(event);

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });

    expect(event.prompt).toHaveBeenCalledOnce();
    expect(outcome).toBe('accepted');
    expect(result.current.isInstalled).toBe(true);
    expect(result.current.canInstall).toBe(false);
  });

  it('clears the prompt without marking installed when dismissed', async () => {
    const { result } = renderHook(() => usePwaInstall());
    fireBeforeInstallPrompt(makeInstallPromptEvent('dismissed'));

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });

    expect(outcome).toBe('dismissed');
    expect(result.current.isInstalled).toBe(false);
    expect(result.current.canInstall).toBe(false);
  });

  it('returns "unavailable" when the native prompt throws', async () => {
    const { result } = renderHook(() => usePwaInstall());
    const event = makeInstallPromptEvent('accepted');
    event.prompt = vi.fn().mockRejectedValue(new Error('not allowed'));
    fireBeforeInstallPrompt(event);

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });
    expect(outcome).toBe('unavailable');
  });

  it('hides the control once the appinstalled event fires', async () => {
    const { result } = renderHook(() => usePwaInstall());
    fireBeforeInstallPrompt(makeInstallPromptEvent('accepted'));
    expect(result.current.canInstall).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    await waitFor(() => expect(result.current.isInstalled).toBe(true));
    expect(result.current.canInstall).toBe(false);
  });

  it('treats an already-standalone window as installed', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.isInstalled).toBe(true);
    expect(result.current.canInstall).toBe(false);
  });

  it('treats an iOS standalone window (no matchMedia) as installed', () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia;
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true });
    try {
      const { result } = renderHook(() => usePwaInstall());
      expect(result.current.isInstalled).toBe(true);
    } finally {
      delete (window.navigator as { standalone?: boolean }).standalone;
    }
  });
});

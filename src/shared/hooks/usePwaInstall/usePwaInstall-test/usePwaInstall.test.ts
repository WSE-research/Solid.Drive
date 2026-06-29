import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  usePwaInstall,
  isStandaloneDisplayMode,
} from '../usePwaInstall-file/usePwaInstall';

/** Replaces window.matchMedia with a stub reporting the given `matches`. */
const setMatchMedia = (matches: boolean): void => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

/** Builds a synthetic `beforeinstallprompt` event with a mocked prompt(). */
const makeBeforeInstallPromptEvent = (
  outcome: 'accepted' | 'dismissed' = 'accepted',
): { event: Event; prompt: ReturnType<typeof vi.fn> } => {
  const event = new Event('beforeinstallprompt');
  const prompt = vi.fn().mockResolvedValue(undefined);
  Object.assign(event, {
    platforms: ['web'],
    prompt,
    userChoice: Promise.resolve({ outcome, platform: 'web' }),
  });
  return { event, prompt };
};

describe('isStandaloneDisplayMode', () => {
  afterEach(() => {
    Reflect.deleteProperty(window.navigator as object, 'standalone');
  });

  it('returns false when neither signal indicates standalone', () => {
    setMatchMedia(false);
    expect(isStandaloneDisplayMode()).toBe(false);
  });

  it('returns true when display-mode: standalone matches', () => {
    setMatchMedia(true);
    expect(isStandaloneDisplayMode()).toBe(true);
  });

  it('returns true for iOS Safari navigator.standalone', () => {
    setMatchMedia(false);
    Object.defineProperty(window.navigator, 'standalone', {
      value: true,
      configurable: true,
    });
    expect(isStandaloneDisplayMode()).toBe(true);
  });
});

describe('usePwaInstall', () => {
  beforeEach(() => setMatchMedia(false));
  afterEach(() => {
    Reflect.deleteProperty(window.navigator as object, 'standalone');
    vi.restoreAllMocks();
  });

  it('starts with nothing installable and not installed', () => {
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.canInstall).toBe(false);
    expect(result.current.isInstalled).toBe(false);
  });

  it('captures beforeinstallprompt, suppresses the default, and flips canInstall', () => {
    const { result } = renderHook(() => usePwaInstall());
    const { event } = makeBeforeInstallPromptEvent();
    const preventDefault = vi.spyOn(event, 'preventDefault');

    act(() => {
      window.dispatchEvent(event);
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(result.current.canInstall).toBe(true);
    expect(result.current.isInstalled).toBe(false);
  });

  it('promptInstall replays the captured prompt and returns the accepted outcome', async () => {
    const { result } = renderHook(() => usePwaInstall());
    const { event, prompt } = makeBeforeInstallPromptEvent('accepted');
    act(() => {
      window.dispatchEvent(event);
    });

    let outcome: 'accepted' | 'dismissed' | null = null;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(outcome).toBe('accepted');
    // A captured prompt is single-use, so the affordance hides afterwards.
    expect(result.current.canInstall).toBe(false);
  });

  it('promptInstall surfaces a dismissed outcome', async () => {
    const { result } = renderHook(() => usePwaInstall());
    const { event } = makeBeforeInstallPromptEvent('dismissed');
    act(() => {
      window.dispatchEvent(event);
    });

    let outcome: 'accepted' | 'dismissed' | null = null;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });

    expect(outcome).toBe('dismissed');
  });

  it('promptInstall resolves to null when no prompt was captured', async () => {
    const { result } = renderHook(() => usePwaInstall());
    let outcome: 'accepted' | 'dismissed' | null = 'accepted';
    await act(async () => {
      outcome = await result.current.promptInstall();
    });
    expect(outcome).toBeNull();
  });

  it('marks installed and hides the affordance on appinstalled', () => {
    const { result } = renderHook(() => usePwaInstall());
    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent().event);
    });
    expect(result.current.canInstall).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.canInstall).toBe(false);
  });

  it('reports installed and never installable when launched standalone', () => {
    setMatchMedia(true);
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.isInstalled).toBe(true);

    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent().event);
    });
    expect(result.current.canInstall).toBe(false);
  });

  it('detaches its listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => usePwaInstall());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('appinstalled', expect.any(Function));
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  EXPERIENCES,
  isExperience,
  useExperiencePreference,
} from '../useExperiencePreference-file/useExperiencePreference';

const LAYOUT_KEY = 'solid-drive.layout';
const THEME_KEY = 'solid-drive.theme';

describe('EXPERIENCES', () => {
  it('is the classic layout plus every shipped theme, in picker order', () => {
    // EXPERIENCES is defined as ['classic', ...THEMES], so deriving the
    // expectation from THEMES would be true by construction. Pin it against an
    // independently written literal instead: that is the only assertion here a
    // change to either union can actually break.
    expect([...EXPERIENCES]).toEqual(['classic', 'light', 'dark', 'dropbox', 'gdrive']);
  });
});

describe('isExperience', () => {
  it('accepts the classic layout and every shipped theme', () => {
    expect(isExperience('classic')).toBe(true);
    expect(isExperience('light')).toBe(true);
    expect(isExperience('dark')).toBe(true);
    expect(isExperience('dropbox')).toBe(true);
    expect(isExperience('gdrive')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isExperience('onedrive')).toBe(false);
    expect(isExperience('system')).toBe(false);
    expect(isExperience(undefined)).toBe(false);
    expect(isExperience(null)).toBe(false);
    expect(isExperience(0)).toBe(false);
  });
});

describe('useExperiencePreference', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('reports "classic" when nothing is stored', () => {
    const { result } = renderHook(() => useExperiencePreference());
    expect(result.current[0]).toBe('classic');
  });

  it('reports "classic" on the classic layout whatever the stored theme is', () => {
    localStorage.setItem(THEME_KEY, 'gdrive');
    const { result } = renderHook(() => useExperiencePreference());
    expect(result.current[0]).toBe('classic');
  });

  it('reports the active theme on the OneDrive layout', () => {
    localStorage.setItem(LAYOUT_KEY, 'onedrive');
    localStorage.setItem(THEME_KEY, 'gdrive');
    const { result } = renderHook(() => useExperiencePreference());
    expect(result.current[0]).toBe('gdrive');
  });

  it('picking a theme writes both preferences and mirrors the theme onto documentElement', () => {
    const { result } = renderHook(() => useExperiencePreference());
    act(() => result.current[1]('gdrive'));

    expect(result.current[0]).toBe('gdrive');
    expect(localStorage.getItem(LAYOUT_KEY)).toBe('onedrive');
    expect(localStorage.getItem(THEME_KEY)).toBe('gdrive');
    expect(document.documentElement.getAttribute('data-theme')).toBe('gdrive');
  });

  it('picking the already-active theme only moves the layout axis', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    const { result } = renderHook(() => useExperiencePreference());
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    act(() => result.current[1]('dark'));

    expect(setItem).toHaveBeenCalledWith(LAYOUT_KEY, 'onedrive');
    expect(setItem).not.toHaveBeenCalledWith(THEME_KEY, expect.anything());
    setItem.mockRestore();
  });

  it('picking classic leaves the theme choice intact for a later return', () => {
    localStorage.setItem(LAYOUT_KEY, 'onedrive');
    localStorage.setItem(THEME_KEY, 'dropbox');
    const { result } = renderHook(() => useExperiencePreference());

    act(() => result.current[1]('classic'));

    expect(result.current[0]).toBe('classic');
    expect(localStorage.getItem(LAYOUT_KEY)).toBe('classic');
    expect(localStorage.getItem(THEME_KEY)).toBe('dropbox');
  });

  it('switches straight from one theme to another', () => {
    const { result } = renderHook(() => useExperiencePreference());

    act(() => result.current[1]('dropbox'));
    act(() => result.current[1]('gdrive'));

    expect(result.current[0]).toBe('gdrive');
    expect(localStorage.getItem(LAYOUT_KEY)).toBe('onedrive');
    expect(localStorage.getItem(THEME_KEY)).toBe('gdrive');
    expect(document.documentElement.getAttribute('data-theme')).toBe('gdrive');
  });

  it('keeps multiple hook instances in sync', () => {
    const first = renderHook(() => useExperiencePreference());
    const second = renderHook(() => useExperiencePreference());

    act(() => first.result.current[1]('gdrive'));

    expect(second.result.current[0]).toBe('gdrive');
  });
});

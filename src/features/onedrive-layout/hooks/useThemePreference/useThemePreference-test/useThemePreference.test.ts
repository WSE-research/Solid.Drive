import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  applyStoredTheme,
  isTheme,
  THEMES,
  useThemePreference,
} from '../useThemePreference-file/useThemePreference';

describe('isTheme', () => {
  it('accepts every shipped theme', () => {
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('light')).toBe(true);
    expect(isTheme('dropbox')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isTheme('system')).toBe(false);
    expect(isTheme(undefined)).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(0)).toBe(false);
  });

  it('stays in step with THEMES', () => {
    // The guard is derived from THEMES, so this pins the two together: adding
    // a theme to the union without listing it here would be caught by the
    // count, and listing one the guard rejects would be caught by the loop.
    expect(THEMES).toHaveLength(3);
    for (const theme of THEMES) expect(isTheme(theme)).toBe(true);
  });
});

describe('useThemePreference', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to "dark" when nothing is stored', () => {
    const { result } = renderHook(() => useThemePreference());
    expect(result.current[0]).toBe('dark');
  });

  it('reads "light" from localStorage on init', () => {
    localStorage.setItem('solid-drive.theme', 'light');
    const { result } = renderHook(() => useThemePreference());
    expect(result.current[0]).toBe('light');
  });

  it('falls back to "dark" on corrupted value', () => {
    localStorage.setItem('solid-drive.theme', 'banana');
    const { result } = renderHook(() => useThemePreference());
    expect(result.current[0]).toBe('dark');
  });

  it('setter updates state, persists, and mirrors to documentElement', () => {
    const { result } = renderHook(() => useThemePreference());
    act(() => result.current[1]('light'));
    expect(result.current[0]).toBe('light');
    expect(localStorage.getItem('solid-drive.theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('reads "dropbox" from localStorage on init', () => {
    localStorage.setItem('solid-drive.theme', 'dropbox');
    const { result } = renderHook(() => useThemePreference());
    expect(result.current[0]).toBe('dropbox');
  });

  it('setter mirrors "dropbox" onto documentElement', () => {
    // The whole Dropbox theme hangs off this attribute value; if it is not
    // written verbatim, every selector in DropboxTheme.css silently misses.
    const { result } = renderHook(() => useThemePreference());
    act(() => result.current[1]('dropbox'));
    expect(result.current[0]).toBe('dropbox');
    expect(localStorage.getItem('solid-drive.theme')).toBe('dropbox');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dropbox');
  });

  it('setter can switch back to dark', () => {
    localStorage.setItem('solid-drive.theme', 'light');
    const { result } = renderHook(() => useThemePreference());
    act(() => result.current[1]('dark'));
    expect(result.current[0]).toBe('dark');
    expect(localStorage.getItem('solid-drive.theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('keeps multiple hook instances in sync', () => {
    const { result: firstInstance } = renderHook(() => useThemePreference());
    const { result: secondInstance } = renderHook(() => useThemePreference());
    expect(firstInstance.current[0]).toBe('dark');
    expect(secondInstance.current[0]).toBe('dark');

    act(() => firstInstance.current[1]('light'));
    expect(firstInstance.current[0]).toBe('light');
    expect(secondInstance.current[0]).toBe('light');
  });

  it('falls back to "dark" when localStorage.getItem throws', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('SecurityError');
      });
    const { result } = renderHook(() => useThemePreference());
    expect(result.current[0]).toBe('dark');
    spy.mockRestore();
  });

  it('still updates in-memory state when localStorage.setItem throws', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
    const { result } = renderHook(() => useThemePreference());
    act(() => result.current[1]('light'));
    expect(result.current[0]).toBe('light');
    spy.mockRestore();
  });
});

describe('applyStoredTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('writes the default "dark" theme when storage is empty', () => {
    applyStoredTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('writes the stored theme to documentElement', () => {
    localStorage.setItem('solid-drive.theme', 'light');
    applyStoredTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('falls back to "dark" when storage access throws', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('SecurityError');
      });
    applyStoredTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    spy.mockRestore();
  });
});

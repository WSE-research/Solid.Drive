import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  applyStoredColorScheme,
  isColorScheme,
  useColorScheme,
  COLOR_SCHEMES,
} from '../useColorScheme-file/useColorScheme';

describe('isColorScheme', () => {
  it('accepts only the known palettes', () => {
    expect(isColorScheme('indigo')).toBe(true);
    expect(isColorScheme('emerald')).toBe(true);
    expect(isColorScheme('amber')).toBe(true);
    expect(isColorScheme('rose')).toBe(true);
    expect(isColorScheme('teal')).toBe(false);
    expect(isColorScheme(undefined)).toBe(false);
    expect(isColorScheme(null)).toBe(false);
    expect(isColorScheme(0)).toBe(false);
  });

  it('exposes all four schemes in display order', () => {
    expect(COLOR_SCHEMES).toEqual(['indigo', 'emerald', 'amber', 'rose']);
  });
});

describe('useColorScheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-scheme');
  });

  it('defaults to "indigo" when nothing is stored', () => {
    const { result } = renderHook(() => useColorScheme());
    expect(result.current[0]).toBe('indigo');
  });

  it('reads a stored scheme on init', () => {
    localStorage.setItem('solid-drive.color-scheme', 'emerald');
    const { result } = renderHook(() => useColorScheme());
    expect(result.current[0]).toBe('emerald');
  });

  it('falls back to "indigo" on a corrupted value', () => {
    localStorage.setItem('solid-drive.color-scheme', 'banana');
    const { result } = renderHook(() => useColorScheme());
    expect(result.current[0]).toBe('indigo');
  });

  it('setter updates state, persists, and mirrors to documentElement', () => {
    const { result } = renderHook(() => useColorScheme());
    act(() => result.current[1]('rose'));
    expect(result.current[0]).toBe('rose');
    expect(localStorage.getItem('solid-drive.color-scheme')).toBe('rose');
    expect(document.documentElement.getAttribute('data-scheme')).toBe('rose');
  });

  it('setter can switch back to indigo', () => {
    localStorage.setItem('solid-drive.color-scheme', 'amber');
    const { result } = renderHook(() => useColorScheme());
    act(() => result.current[1]('indigo'));
    expect(result.current[0]).toBe('indigo');
    expect(document.documentElement.getAttribute('data-scheme')).toBe('indigo');
  });

  it('keeps multiple hook instances in sync', () => {
    const { result: first } = renderHook(() => useColorScheme());
    const { result: second } = renderHook(() => useColorScheme());
    expect(first.current[0]).toBe('indigo');

    act(() => first.current[1]('emerald'));
    expect(first.current[0]).toBe('emerald');
    expect(second.current[0]).toBe('emerald');
  });

  it('falls back to "indigo" when localStorage.getItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const { result } = renderHook(() => useColorScheme());
    expect(result.current[0]).toBe('indigo');
    spy.mockRestore();
  });

  it('still updates in-memory state when localStorage.setItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const { result } = renderHook(() => useColorScheme());
    act(() => result.current[1]('rose'));
    expect(result.current[0]).toBe('rose');
    spy.mockRestore();
  });
});

describe('applyStoredColorScheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-scheme');
  });

  it('writes the default "indigo" scheme when storage is empty', () => {
    applyStoredColorScheme();
    expect(document.documentElement.getAttribute('data-scheme')).toBe('indigo');
  });

  it('writes the stored scheme to documentElement', () => {
    localStorage.setItem('solid-drive.color-scheme', 'amber');
    applyStoredColorScheme();
    expect(document.documentElement.getAttribute('data-scheme')).toBe('amber');
  });

  it('falls back to "indigo" when storage access throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    applyStoredColorScheme();
    expect(document.documentElement.getAttribute('data-scheme')).toBe('indigo');
    spy.mockRestore();
  });
});

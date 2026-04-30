import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayoutPreference } from '../useLayoutPreference-file/useLayoutPreference';

describe('useLayoutPreference', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to "classic" when nothing is stored', () => {
    const { result } = renderHook(() => useLayoutPreference());
    expect(result.current[0]).toBe('classic');
  });

  it('reads "onedrive" from localStorage on init', () => {
    localStorage.setItem('solid-drive.layout', 'onedrive');
    const { result } = renderHook(() => useLayoutPreference());
    expect(result.current[0]).toBe('onedrive');
  });

  it('falls back to "classic" on corrupted value', () => {
    localStorage.setItem('solid-drive.layout', 'banana');
    const { result } = renderHook(() => useLayoutPreference());
    expect(result.current[0]).toBe('classic');
  });

  it('falls back to "classic" on empty string', () => {
    localStorage.setItem('solid-drive.layout', '');
    const { result } = renderHook(() => useLayoutPreference());
    expect(result.current[0]).toBe('classic');
  });

  it('setter updates state and persists to localStorage', () => {
    const { result } = renderHook(() => useLayoutPreference());
    act(() => result.current[1]('onedrive'));
    expect(result.current[0]).toBe('onedrive');
    expect(localStorage.getItem('solid-drive.layout')).toBe('onedrive');
  });

  it('setter can switch back to classic', () => {
    localStorage.setItem('solid-drive.layout', 'onedrive');
    const { result } = renderHook(() => useLayoutPreference());
    act(() => result.current[1]('classic'));
    expect(result.current[0]).toBe('classic');
    expect(localStorage.getItem('solid-drive.layout')).toBe('classic');
  });

  it('keeps multiple hook instances in sync when one updates', () => {
    const { result: a } = renderHook(() => useLayoutPreference());
    const { result: b } = renderHook(() => useLayoutPreference());
    expect(a.current[0]).toBe('classic');
    expect(b.current[0]).toBe('classic');

    act(() => a.current[1]('onedrive'));
    expect(a.current[0]).toBe('onedrive');
    expect(b.current[0]).toBe('onedrive');

    act(() => b.current[1]('classic'));
    expect(a.current[0]).toBe('classic');
    expect(b.current[0]).toBe('classic');
  });
});

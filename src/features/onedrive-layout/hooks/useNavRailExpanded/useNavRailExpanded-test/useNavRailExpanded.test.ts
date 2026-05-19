import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNavRailExpanded } from '../useNavRailExpanded-file/useNavRailExpanded';

describe('useNavRailExpanded', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to expanded when nothing is stored', () => {
    const { result } = renderHook(() => useNavRailExpanded());
    expect(result.current[0]).toBe(true);
  });

  it('reads "false" from localStorage on init', () => {
    localStorage.setItem('solid-drive.navRailExpanded', 'false');
    const { result } = renderHook(() => useNavRailExpanded());
    expect(result.current[0]).toBe(false);
  });

  it('reads "true" from localStorage on init', () => {
    localStorage.setItem('solid-drive.navRailExpanded', 'true');
    const { result } = renderHook(() => useNavRailExpanded());
    expect(result.current[0]).toBe(true);
  });

  it('falls back to expanded on corrupted value', () => {
    localStorage.setItem('solid-drive.navRailExpanded', 'banana');
    const { result } = renderHook(() => useNavRailExpanded());
    expect(result.current[0]).toBe(true);
  });

  it('setter updates state and persists', () => {
    const { result } = renderHook(() => useNavRailExpanded());
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
    expect(localStorage.getItem('solid-drive.navRailExpanded')).toBe('false');
  });

  it('keeps multiple hook instances in sync', () => {
    const { result: a } = renderHook(() => useNavRailExpanded());
    const { result: b } = renderHook(() => useNavRailExpanded());
    expect(a.current[0]).toBe(true);
    expect(b.current[0]).toBe(true);

    act(() => a.current[1](false));
    expect(a.current[0]).toBe(false);
    expect(b.current[0]).toBe(false);

    act(() => b.current[1](true));
    expect(a.current[0]).toBe(true);
    expect(b.current[0]).toBe(true);
  });

  it('falls back to expanded when localStorage.getItem throws', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('SecurityError');
      });
    const { result } = renderHook(() => useNavRailExpanded());
    expect(result.current[0]).toBe(true);
    spy.mockRestore();
  });

  it('still updates in-memory state when setItem throws', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
    const { result } = renderHook(() => useNavRailExpanded());
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
    spy.mockRestore();
  });
});

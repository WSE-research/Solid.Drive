import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMyFilesSort } from '../useMyFilesSort-file/useMyFilesSort';

const KEY = 'onedrive-layout.myFiles.sort';

describe('useMyFilesSort', () => {
  beforeEach(() => sessionStorage.clear());

  it('defaults to name asc', () => {
    const { result } = renderHook(() => useMyFilesSort());
    expect(result.current.sort).toEqual({ key: 'name', direction: 'asc' });
  });

  it('reads stored value on init', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ key: 'modified', direction: 'desc' }));
    const { result } = renderHook(() => useMyFilesSort());
    expect(result.current.sort).toEqual({ key: 'modified', direction: 'desc' });
  });

  it('falls back to default on garbage value', () => {
    sessionStorage.setItem(KEY, 'not-json');
    const { result } = renderHook(() => useMyFilesSort());
    expect(result.current.sort).toEqual({ key: 'name', direction: 'asc' });
  });

  it('setSort persists', () => {
    const { result } = renderHook(() => useMyFilesSort());
    act(() => result.current.setSort({ key: 'size', direction: 'desc' }));
    expect(result.current.sort).toEqual({ key: 'size', direction: 'desc' });
    expect(JSON.parse(sessionStorage.getItem(KEY) ?? '{}')).toEqual({ key: 'size', direction: 'desc' });
  });

  it('rejects unknown sort keys and stays on default', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ key: 'banana', direction: 'asc' }));
    const { result } = renderHook(() => useMyFilesSort());
    expect(result.current.sort).toEqual({ key: 'name', direction: 'asc' });
  });

  it('falls back to default on an invalid direction', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ key: 'name', direction: 'sideways' }));
    const { result } = renderHook(() => useMyFilesSort());
    expect(result.current.sort).toEqual({ key: 'name', direction: 'asc' });
  });

  it('setSort rejects an invalid value silently and does not persist', () => {
    const { result } = renderHook(() => useMyFilesSort());
    act(() =>
      result.current.setSort({
        key: 'banana' as 'name',
        direction: 'asc',
      }),
    );
    expect(result.current.sort).toEqual({ key: 'name', direction: 'asc' });
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('treats a JSON null value as invalid and falls back to default', () => {
    sessionStorage.setItem(KEY, 'null');
    const { result } = renderHook(() => useMyFilesSort());
    expect(result.current.sort).toEqual({ key: 'name', direction: 'asc' });
  });

  it('treats a JSON primitive (string) as invalid and falls back to default', () => {
    sessionStorage.setItem(KEY, JSON.stringify('not-an-object'));
    const { result } = renderHook(() => useMyFilesSort());
    expect(result.current.sort).toEqual({ key: 'name', direction: 'asc' });
  });

  it('still updates in-memory state when sessionStorage.setItem throws', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
    const { result } = renderHook(() => useMyFilesSort());
    act(() => result.current.setSort({ key: 'modified', direction: 'desc' }));
    expect(result.current.sort).toEqual({ key: 'modified', direction: 'desc' });
    spy.mockRestore();
  });
});

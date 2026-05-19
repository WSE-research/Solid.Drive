import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  __resetSharedCatalogVersionForTests,
  notifySharedCatalogsChanged,
  useSharedCatalogVersion,
} from '../useSharedCatalogVersion-file/useSharedCatalogVersion';

beforeEach(() => {
  __resetSharedCatalogVersionForTests();
});

describe('useSharedCatalogVersion', () => {
  it('returns 0 before any notification', () => {
    const { result } = renderHook(() => useSharedCatalogVersion());
    expect(result.current).toBe(0);
  });

  it('increments globally after notifySharedCatalogsChanged', () => {
    const { result } = renderHook(() => useSharedCatalogVersion());
    act(() => notifySharedCatalogsChanged());
    expect(result.current).toBe(1);
    act(() => notifySharedCatalogsChanged());
    expect(result.current).toBe(2);
  });

  it('every subscriber sees the same bump (single global counter)', () => {
    const a = renderHook(() => useSharedCatalogVersion());
    const b = renderHook(() => useSharedCatalogVersion());
    act(() => notifySharedCatalogsChanged());
    expect(a.result.current).toBe(1);
    expect(b.result.current).toBe(1);
  });

  it('unsubscribes on unmount so notifySharedCatalogsChanged does not throw', () => {
    const { unmount } = renderHook(() => useSharedCatalogVersion());
    unmount();
    expect(() => notifySharedCatalogsChanged()).not.toThrow();
  });

  it('__resetSharedCatalogVersionForTests clears the counter', () => {
    notifySharedCatalogsChanged();
    notifySharedCatalogsChanged();
    __resetSharedCatalogVersionForTests();
    const { result } = renderHook(() => useSharedCatalogVersion());
    expect(result.current).toBe(0);
  });
});

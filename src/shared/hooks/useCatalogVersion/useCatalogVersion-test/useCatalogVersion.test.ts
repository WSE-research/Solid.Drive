import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  __resetCatalogVersionsForTests,
  notifyCatalogChanged,
  useCatalogVersion,
} from '../useCatalogVersion-file/useCatalogVersion';

beforeEach(() => {
  __resetCatalogVersionsForTests();
});

describe('useCatalogVersion', () => {
  it('returns 0 when the URI has never been notified', () => {
    const { result } = renderHook(() => useCatalogVersion('https://pod/catalog.ttl'));
    expect(result.current).toBe(0);
  });

  it('returns 0 for an undefined URI without subscribing to anything', () => {
    const { result } = renderHook(() => useCatalogVersion(undefined));
    expect(result.current).toBe(0);
  });

  it('increments after notifyCatalogChanged is called for the same URI', () => {
    const { result } = renderHook(() => useCatalogVersion('https://pod/catalog.ttl'));
    expect(result.current).toBe(0);
    act(() => notifyCatalogChanged('https://pod/catalog.ttl'));
    expect(result.current).toBe(1);
    act(() => notifyCatalogChanged('https://pod/catalog.ttl'));
    expect(result.current).toBe(2);
  });

  it('does not increment when a different catalog URI changes', () => {
    const { result } = renderHook(() => useCatalogVersion('https://pod-a/catalog.ttl'));
    act(() => notifyCatalogChanged('https://pod-b/catalog.ttl'));
    expect(result.current).toBe(0);
  });

  it('two subscribers to the same URI both see the bump', () => {
    const a = renderHook(() => useCatalogVersion('https://pod/c.ttl'));
    const b = renderHook(() => useCatalogVersion('https://pod/c.ttl'));
    act(() => notifyCatalogChanged('https://pod/c.ttl'));
    expect(a.result.current).toBe(1);
    expect(b.result.current).toBe(1);
  });

  it('unsubscribes on unmount so notifyCatalogChanged does not throw', () => {
    const { unmount } = renderHook(() => useCatalogVersion('https://pod/c.ttl'));
    unmount();
    expect(() => notifyCatalogChanged('https://pod/c.ttl')).not.toThrow();
  });

  it('__resetCatalogVersionsForTests clears every URI counter', () => {
    notifyCatalogChanged('https://pod/a.ttl');
    notifyCatalogChanged('https://pod/b.ttl');
    __resetCatalogVersionsForTests();
    const { result: a } = renderHook(() => useCatalogVersion('https://pod/a.ttl'));
    const { result: b } = renderHook(() => useCatalogVersion('https://pod/b.ttl'));
    expect(a.current).toBe(0);
    expect(b.current).toBe(0);
  });
});

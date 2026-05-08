import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  __resetAclVersionsForTests,
  notifyAclChanged,
  useAclVersion,
} from '../useAclVersion-file/useAclVersion';

beforeEach(() => {
  __resetAclVersionsForTests();
});

describe('useAclVersion', () => {
  it('returns 0 when the URI has never been notified', () => {
    const { result } = renderHook(() => useAclVersion('https://pod/file/'));
    expect(result.current).toBe(0);
  });

  it('returns 0 for an undefined URI without subscribing to anything', () => {
    const { result } = renderHook(() => useAclVersion(undefined));
    expect(result.current).toBe(0);
  });

  it('increments after notifyAclChanged is called for the same URI', () => {
    const { result } = renderHook(() => useAclVersion('https://pod/file/'));
    expect(result.current).toBe(0);
    act(() => notifyAclChanged('https://pod/file/'));
    expect(result.current).toBe(1);
    act(() => notifyAclChanged('https://pod/file/'));
    expect(result.current).toBe(2);
  });

  it('does not increment when a different URI changes', () => {
    const { result } = renderHook(() => useAclVersion('https://pod/file-a/'));
    act(() => notifyAclChanged('https://pod/file-b/'));
    expect(result.current).toBe(0);
  });

  it('two subscribers to the same URI both see the bump', () => {
    const a = renderHook(() => useAclVersion('https://pod/x/'));
    const b = renderHook(() => useAclVersion('https://pod/x/'));
    act(() => notifyAclChanged('https://pod/x/'));
    expect(a.result.current).toBe(1);
    expect(b.result.current).toBe(1);
  });

  it('unsubscribes on unmount so notifyAclChanged does not throw', () => {
    const { unmount } = renderHook(() => useAclVersion('https://pod/y/'));
    unmount();
    expect(() => notifyAclChanged('https://pod/y/')).not.toThrow();
  });

  it('__resetAclVersionsForTests clears every URI counter', () => {
    notifyAclChanged('https://pod/a/');
    notifyAclChanged('https://pod/b/');
    __resetAclVersionsForTests();
    const { result: a } = renderHook(() => useAclVersion('https://pod/a/'));
    const { result: b } = renderHook(() => useAclVersion('https://pod/b/'));
    expect(a.current).toBe(0);
    expect(b.current).toBe(0);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewParam } from '../useViewParam-file/useViewParam';

const setUrl = (search: string) => window.history.replaceState({}, '', search);

describe('useViewParam', () => {
  beforeEach(() => setUrl('/'));

  it('defaults to "recent" when no ?view= is present', () => {
    const { result } = renderHook(() => useViewParam());
    expect(result.current[0]).toBe('recent');
  });

  it('reads "shared" from ?view=shared', () => {
    setUrl('/?view=shared');
    const { result } = renderHook(() => useViewParam());
    expect(result.current[0]).toBe('shared');
  });

  it('reads each known view id from the URL', () => {
    const ids = ['recent', 'my-files', 'shared', 'requests', 'people'] as const;
    for (const id of ids) {
      setUrl(`/?view=${id}`);
      const { result } = renderHook(() => useViewParam());
      expect(result.current[0]).toBe(id);
    }
  });

  it('falls back to "recent" on unknown view id', () => {
    setUrl('/?view=nope');
    const { result } = renderHook(() => useViewParam());
    expect(result.current[0]).toBe('recent');
  });

  it('setter updates state and writes ?view= via replaceState', () => {
    const { result } = renderHook(() => useViewParam());
    act(() => result.current[1]('shared'));
    expect(result.current[0]).toBe('shared');
    expect(window.location.search).toContain('view=shared');
  });

  it('setter does not push a new history entry', () => {
    const initialLength = window.history.length;
    const { result } = renderHook(() => useViewParam());
    act(() => result.current[1]('shared'));
    expect(window.history.length).toBe(initialLength);
  });

  it('responds to popstate events', () => {
    const { result } = renderHook(() => useViewParam());
    act(() => {
      window.history.pushState({}, '', '/?view=people');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current[0]).toBe('people');
  });

  it('cleans up popstate listener on unmount', () => {
    const { unmount, result } = renderHook(() => useViewParam());
    unmount();
    act(() => {
      window.history.pushState({}, '', '/?view=shared');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    // Result is stale because hook unmounted; we just verify no crash.
    expect(result.current[0]).toBe('recent');
  });

  it('keeps multiple hook instances in sync when one updates', () => {
    // NavRail and OneDriveLayout each call useViewParam(); flipping the view
    // from one must immediately re-render the other.
    const { result: a } = renderHook(() => useViewParam());
    const { result: b } = renderHook(() => useViewParam());
    expect(a.current[0]).toBe('recent');
    expect(b.current[0]).toBe('recent');

    act(() => a.current[1]('my-files'));
    expect(a.current[0]).toBe('my-files');
    expect(b.current[0]).toBe('my-files');

    act(() => b.current[1]('shared'));
    expect(a.current[0]).toBe('shared');
    expect(b.current[0]).toBe('shared');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useResizeObserver } from '../useResizeObserver-file/useResizeObserver';

type ObserverCallback = (entries: ResizeObserverEntry[]) => void;

const stubDOMRect = (width: number, height: number): DOMRect => ({
  width,
  height,
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: width,
  bottom: height,
  toJSON: () => ({}),
});

describe('useResizeObserver — no ResizeObserver available', () => {
  let originalResizeObserver: typeof globalThis.ResizeObserver | undefined;

  beforeEach(() => {
    originalResizeObserver = globalThis.ResizeObserver;
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = undefined;
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver as typeof globalThis.ResizeObserver;
  });

  it('falls back to zero size when ref is null', () => {
    const { result } = renderHook(() => useResizeObserver({ current: null }));
    expect(result.current).toEqual({ width: 0, height: 0 });
  });

  it('still measures the element synchronously on mount', () => {
    const element = document.createElement('div');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(stubDOMRect(640, 320));
    const ref = { current: element };
    const { result } = renderHook(() => useResizeObserver(ref));
    expect(result.current).toEqual({ width: 640, height: 320 });
  });
});

describe('useResizeObserver — with ResizeObserver', () => {
  let originalResizeObserver: typeof globalThis.ResizeObserver | undefined;
  let lastCallback: ObserverCallback | undefined;
  const observe = vi.fn();
  const disconnect = vi.fn();

  beforeEach(() => {
    lastCallback = undefined;
    observe.mockClear();
    disconnect.mockClear();
    originalResizeObserver = globalThis.ResizeObserver;

    class MockResizeObserver {
      constructor(callback: ObserverCallback) {
        lastCallback = callback;
      }
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
    }

    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof globalThis.ResizeObserver;
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver as typeof globalThis.ResizeObserver;
  });

  it('observes the element and updates size when the observer fires', () => {
    const element = document.createElement('div');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(stubDOMRect(100, 50));
    const ref = { current: element };

    const { result } = renderHook(() => useResizeObserver(ref));
    expect(observe).toHaveBeenCalledWith(element);
    expect(result.current).toEqual({ width: 100, height: 50 });

    act(() => {
      lastCallback?.([
        { contentRect: stubDOMRect(960, 540) } as ResizeObserverEntry,
      ]);
    });

    expect(result.current).toEqual({ width: 960, height: 540 });
  });

  it('ignores empty entry arrays from the observer', () => {
    const element = document.createElement('div');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(stubDOMRect(200, 100));
    const ref = { current: element };

    const { result } = renderHook(() => useResizeObserver(ref));

    act(() => {
      lastCallback?.([]);
    });

    expect(result.current).toEqual({ width: 200, height: 100 });
  });

  it('disconnects the observer on unmount', () => {
    const element = document.createElement('div');
    const ref = { current: element };
    const { unmount } = renderHook(() => useResizeObserver(ref));
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});

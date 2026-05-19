import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const mockNotifyCatalog = vi.fn();
const mockNotifyShared = vi.fn();

vi.mock('@/shared/hooks/useCatalogVersion', () => ({
  notifyCatalogChanged: (...args: unknown[]) => mockNotifyCatalog(...args),
}));

vi.mock('@/shared/hooks/useSharedCatalogVersion', () => ({
  notifySharedCatalogsChanged: (...args: unknown[]) => mockNotifyShared(...args),
}));

import { useRefreshCatalogsOnFocus } from '../useRefreshCatalogsOnFocus-file/useRefreshCatalogsOnFocus';

const CATALOG = 'https://pod/catalog.ttl';

beforeEach(() => {
  mockNotifyCatalog.mockReset();
  mockNotifyShared.mockReset();
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  });
});

describe('useRefreshCatalogsOnFocus', () => {
  it('notifies both catalog and shared-catalog signals on window focus', () => {
    renderHook(() => useRefreshCatalogsOnFocus(CATALOG));
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(mockNotifyCatalog).toHaveBeenCalledWith(CATALOG);
    expect(mockNotifyShared).toHaveBeenCalledTimes(1);
  });

  it('notifies on visibilitychange when the tab becomes visible', () => {
    renderHook(() => useRefreshCatalogsOnFocus(CATALOG));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(mockNotifyCatalog).toHaveBeenCalledWith(CATALOG);
    expect(mockNotifyShared).toHaveBeenCalledTimes(1);
  });

  it('ignores visibilitychange when the tab is hidden', () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    renderHook(() => useRefreshCatalogsOnFocus(CATALOG));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(mockNotifyCatalog).not.toHaveBeenCalled();
    expect(mockNotifyShared).not.toHaveBeenCalled();
  });

  it('only fires the shared-catalog signal when catalogUri is undefined', () => {
    renderHook(() => useRefreshCatalogsOnFocus(undefined));
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(mockNotifyCatalog).not.toHaveBeenCalled();
    expect(mockNotifyShared).toHaveBeenCalledTimes(1);
  });

  it('cleans up listeners on unmount', () => {
    const { unmount } = renderHook(() => useRefreshCatalogsOnFocus(CATALOG));
    unmount();
    act(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(mockNotifyCatalog).not.toHaveBeenCalled();
    expect(mockNotifyShared).not.toHaveBeenCalled();
  });
});

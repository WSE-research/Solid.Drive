import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { type ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let mockProfileValue: Record<string, unknown> | null = {
  storage: { toArray: () => [{ '@id': 'https://pod.example/' }] },
  knows: { toArray: () => [{ '@id': 'https://alice.example/profile/card#me' }] },
};
let mockWebIdResource: Record<string, unknown> = { isLoading: () => false, reload: vi.fn().mockResolvedValue(undefined) };
const mockGetResource = vi.fn();

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ session: { webId: 'https://pod.example/profile/card#me' } }),
  useLdo: () => ({ getResource: mockGetResource }),
  useSubject: () => mockProfileValue,
  useResource: () => mockWebIdResource,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({
  SolidProfileShapeType: 'SolidProfileShapeType',
}));

vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isLoadable: (res: unknown) => res != null && typeof (res as Record<string, unknown>).isLoading === 'function',
  isReloadable: (res: unknown) => res != null && typeof (res as Record<string, unknown>).reload === 'function',
}));

vi.mock('@/infrastructure/solid/sharedCatalog', () => ({
  getAppContainerUri: (root: string) => `${root}my-solid-app/`,
}));

vi.mock('@/infrastructure/solid/storageDiscovery', () => ({
  discoverStorageRoot: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/config', () => ({
  STORAGE_RETRY_DELAY_MS: 10000,
}));

import { useDriveInitialization } from '../useDriveInitialization-file/useDriveInitialization';

function testWrapper(initialEntry = '/') {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      MemoryRouter,
      { initialEntries: [initialEntry] },
      children
    );
  };
}

describe('useDriveInitialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockProfileValue = {
      storage: { toArray: () => [{ '@id': 'https://pod.example/' }] },
      knows: { toArray: () => [{ '@id': 'https://alice.example/profile/card#me' }] },
    };
    mockWebIdResource = { isLoading: () => false, reload: vi.fn().mockResolvedValue(undefined) };
    mockGetResource.mockReturnValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes storage URIs, navigation state, retry handler, and navigation handlers', () => {
    const { result } = renderHook(() => useDriveInitialization(), { wrapper: testWrapper() });
    expect(result.current).toHaveProperty('appContainerUri');
    expect(result.current).toHaveProperty('storageRootUri');
    expect(result.current).toHaveProperty('currentUri');
    expect(result.current).toHaveProperty('setCurrentUri');
    expect(result.current).toHaveProperty('breadcrumbs');
    expect(result.current).toHaveProperty('setBreadcrumbs');
    expect(result.current).toHaveProperty('noStorageDetected');
    expect(result.current).toHaveProperty('handleRetryStorage');
    expect(result.current).toHaveProperty('handleNavigate');
    expect(result.current).toHaveProperty('handleBreadcrumbClick');
  });

  it('initializes with storage root from profile', () => {
    const { result } = renderHook(() => useDriveInitialization(), { wrapper: testWrapper() });
    expect(result.current.storageRootUri).toBe('https://pod.example/');
    expect(result.current.appContainerUri).toBe('https://pod.example/my-solid-app/');
    expect(result.current.currentUri).toBe('https://pod.example/');
  });

  it('sets initial breadcrumbs', () => {
    const { result } = renderHook(() => useDriveInitialization(), { wrapper: testWrapper() });
    expect(result.current.breadcrumbs).toHaveLength(1);
    expect(result.current.breadcrumbs[0].label).toBe('fileExplorer.myPod');
    expect(result.current.breadcrumbs[0].uri).toBe('https://pod.example/');
  });

  it('creates app container if createIfAbsent is available', () => {
    const mockCreateIfAbsent = vi.fn().mockResolvedValue(undefined);
    mockGetResource.mockReturnValue({ createIfAbsent: mockCreateIfAbsent });
    renderHook(() => useDriveInitialization(), { wrapper: testWrapper() });
    expect(mockCreateIfAbsent).toHaveBeenCalled();
  });

  it('noStorageDetected is false when storage exists', () => {
    const { result } = renderHook(() => useDriveInitialization(), { wrapper: testWrapper() });
    expect(result.current.noStorageDetected).toBe(false);
  });

  it('sets noStorageDetected when profile has no storage and resource done loading', async () => {
    mockProfileValue = {
      storage: { toArray: () => [] },
      knows: { toArray: () => [] },
    };
    mockWebIdResource = { isLoading: () => false, reload: vi.fn().mockResolvedValue(undefined) };
    const { result } = renderHook(() => useDriveInitialization(), { wrapper: testWrapper() });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.noStorageDetected).toBe(true);
  });

  it('does not set noStorageDetected when resource is still loading', () => {
    mockProfileValue = {
      storage: { toArray: () => [] },
      knows: { toArray: () => [] },
    };
    mockWebIdResource = { isLoading: () => true, reload: vi.fn().mockResolvedValue(undefined) };
    const { result } = renderHook(() => useDriveInitialization(), { wrapper: testWrapper() });
    expect(result.current.noStorageDetected).toBe(false);
  });

  it('retry timer calls handleRetryStorage after delay', async () => {
    mockProfileValue = {
      storage: { toArray: () => [] },
      knows: { toArray: () => [] },
    };
    mockWebIdResource = { isLoading: () => false, reload: vi.fn().mockResolvedValue(undefined) };
    const { result } = renderHook(() => useDriveInitialization(500), {
      wrapper: testWrapper(),
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.noStorageDetected).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(mockWebIdResource.reload).toHaveBeenCalled();
  });

  it('handleRetryStorage resets state and reloads resource', async () => {
    const { result } = renderHook(() => useDriveInitialization(), { wrapper: testWrapper() });
    await act(async () => {
      await result.current.handleRetryStorage();
    });
    expect(mockWebIdResource.reload).toHaveBeenCalled();
  });

  it('handleRetryStorage returns early when webIdResource is not reloadable', async () => {
    // Remove reload method to make isReloadable return false
    mockWebIdResource = { isLoading: () => false };
    const { result } = renderHook(() => useDriveInitialization(), { wrapper: testWrapper() });
    await act(async () => {
      await result.current.handleRetryStorage();
    });
    // Since webIdResource has no reload method, isReloadable returns false, so reload is never called
    // No error should occur — the function just returns early
    expect(result.current.noStorageDetected).toBe(false);
  });

  it('handleNavigate pushes a new folder onto the breadcrumb trail and updates currentUri', () => {
    const { result } = renderHook(() => useDriveInitialization(), { wrapper: testWrapper() });
    act(() => {
      result.current.handleNavigate('https://pod.example/my-solid-app/photos/');
    });
    expect(result.current.currentUri).toBe('https://pod.example/my-solid-app/photos/');
    expect(result.current.breadcrumbs).toHaveLength(3);
    expect(result.current.breadcrumbs[2].uri).toBe('https://pod.example/my-solid-app/photos/');
    expect(result.current.breadcrumbs[2].label).toBe('photos');
  });

  it('handleBreadcrumbClick trims the breadcrumb trail and updates currentUri', () => {
    const { result } = renderHook(() => useDriveInitialization(), { wrapper: testWrapper() });
    act(() => {
      result.current.handleNavigate('https://pod.example/my-solid-app/photos/');
      result.current.handleNavigate('https://pod.example/my-solid-app/photos/vacation/');
    });
    expect(result.current.breadcrumbs).toHaveLength(4);

    act(() => {
      result.current.handleBreadcrumbClick(
        2,
        'https://pod.example/my-solid-app/photos/' as import('@ldo/connected-solid').SolidContainerUri
      );
    });
    expect(result.current.currentUri).toBe('https://pod.example/my-solid-app/photos/');
    expect(result.current.breadcrumbs).toHaveLength(3);
    expect(result.current.breadcrumbs[2].uri).toBe('https://pod.example/my-solid-app/photos/');
  });

  it('respects a valid folder deep link in the URL', () => {
    const deepUri = encodeURIComponent('https://pod.example/my-solid-app/photos/');
    const { result } = renderHook(() => useDriveInitialization(), {
      wrapper: testWrapper(`/?folder=${deepUri}`),
    });
    expect(result.current.currentUri).toBe('https://pod.example/my-solid-app/photos/');
  });

  it('setCurrentUri navigates when the URI sits under the storage root', () => {
    const { result } = renderHook(() => useDriveInitialization(), { wrapper: testWrapper() });
    act(() => {
      result.current.setCurrentUri(
        'https://pod.example/my-solid-app/sub/' as import('@ldo/connected-solid').SolidContainerUri,
      );
    });
    expect(result.current.currentUri).toBe('https://pod.example/my-solid-app/sub/');
  });

  it('setCurrentUri ignores undefined and URIs outside the storage root', () => {
    const { result } = renderHook(() => useDriveInitialization(), { wrapper: testWrapper() });
    const before = result.current.currentUri;
    act(() => {
      result.current.setCurrentUri(undefined);
    });
    expect(result.current.currentUri).toBe(before);
    act(() => {
      result.current.setCurrentUri(
        'https://other-pod.example/foo/' as import('@ldo/connected-solid').SolidContainerUri,
      );
    });
    expect(result.current.currentUri).toBe(before);
  });

  it('setBreadcrumbs navigates to the last breadcrumb when given an array', () => {
    const { result } = renderHook(() => useDriveInitialization(), { wrapper: testWrapper() });
    act(() => {
      result.current.setBreadcrumbs([
        { label: 'fileExplorer.myPod', uri: 'https://pod.example/' },
        { label: 'photos', uri: 'https://pod.example/my-solid-app/photos/' },
      ]);
    });
    expect(result.current.currentUri).toBe('https://pod.example/my-solid-app/photos/');
  });

  it('setBreadcrumbs ignores trails whose last segment falls outside the storage root', () => {
    const { result } = renderHook(() => useDriveInitialization(), { wrapper: testWrapper() });
    const before = result.current.currentUri;
    act(() => {
      result.current.setBreadcrumbs([
        { label: 'elsewhere', uri: 'https://other-pod.example/foo/' },
      ]);
    });
    expect(result.current.currentUri).toBe(before);
  });

  it('handleNavigate ignores URIs outside the storage root', () => {
    const { result } = renderHook(() => useDriveInitialization(), { wrapper: testWrapper() });
    const before = result.current.currentUri;
    act(() => {
      result.current.handleNavigate('https://other-pod.example/foo/');
    });
    expect(result.current.currentUri).toBe(before);
  });

  it('handleBreadcrumbClick ignores URIs outside the storage root', () => {
    const { result } = renderHook(() => useDriveInitialization(), { wrapper: testWrapper() });
    const before = result.current.currentUri;
    act(() => {
      result.current.handleBreadcrumbClick(
        0,
        'https://other-pod.example/foo/' as import('@ldo/connected-solid').SolidContainerUri,
      );
    });
    expect(result.current.currentUri).toBe(before);
  });

  it('handleNavigate and handleBreadcrumbClick early-return when storageRootUri is undefined', () => {
    mockProfileValue = null;
    const { result } = renderHook(() => useDriveInitialization(), { wrapper: testWrapper() });
    expect(result.current.storageRootUri).toBeUndefined();
    act(() => {
      result.current.handleNavigate('https://anything.example/foo/');
      result.current.handleBreadcrumbClick(
        0,
        'https://anything.example/foo/' as import('@ldo/connected-solid').SolidContainerUri,
      );
    });
    // No navigation occurred, currentUri remains undefined.
    expect(result.current.currentUri).toBeUndefined();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

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

vi.mock('@/config', () => ({
  STORAGE_RETRY_DELAY_MS: 10000,
}));

import { useDriveInitialization } from '../useDriveInitialization-file/useDriveInitialization';

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

  it('exposes storage URIs, navigation state, retry handler, navigation handlers, and contacts', () => {
    const { result } = renderHook(() => useDriveInitialization());
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
    expect(result.current).toHaveProperty('contacts');
  });

  it('initializes with storage root from profile', () => {
    const { result } = renderHook(() => useDriveInitialization());
    expect(result.current.storageRootUri).toBe('https://pod.example/');
    expect(result.current.appContainerUri).toBe('https://pod.example/my-solid-app/');
    expect(result.current.currentUri).toBe('https://pod.example/');
  });

  it('extracts contacts from profile', () => {
    const { result } = renderHook(() => useDriveInitialization());
    expect(result.current.contacts).toEqual(['https://alice.example/profile/card#me']);
  });

  it('sets initial breadcrumbs', () => {
    const { result } = renderHook(() => useDriveInitialization());
    expect(result.current.breadcrumbs).toHaveLength(1);
    expect(result.current.breadcrumbs[0].label).toBe('fileExplorer.myPod');
    expect(result.current.breadcrumbs[0].uri).toBe('https://pod.example/');
  });

  it('creates app container if createIfAbsent is available', () => {
    const mockCreateIfAbsent = vi.fn().mockResolvedValue(undefined);
    mockGetResource.mockReturnValue({ createIfAbsent: mockCreateIfAbsent });
    renderHook(() => useDriveInitialization());
    expect(mockCreateIfAbsent).toHaveBeenCalled();
  });

  it('noStorageDetected is false when storage exists', () => {
    const { result } = renderHook(() => useDriveInitialization());
    expect(result.current.noStorageDetected).toBe(false);
  });

  it('sets noStorageDetected when profile has no storage and resource done loading', () => {
    mockProfileValue = {
      storage: { toArray: () => [] },
      knows: { toArray: () => [] },
    };
    mockWebIdResource = { isLoading: () => false, reload: vi.fn().mockResolvedValue(undefined) };
    const { result } = renderHook(() => useDriveInitialization());
    expect(result.current.noStorageDetected).toBe(true);
  });

  it('does not set noStorageDetected when resource is still loading', () => {
    mockProfileValue = {
      storage: { toArray: () => [] },
      knows: { toArray: () => [] },
    };
    mockWebIdResource = { isLoading: () => true, reload: vi.fn().mockResolvedValue(undefined) };
    const { result } = renderHook(() => useDriveInitialization());
    expect(result.current.noStorageDetected).toBe(false);
  });

  it('retry timer calls handleRetryStorage after delay', async () => {
    mockProfileValue = {
      storage: { toArray: () => [] },
      knows: { toArray: () => [] },
    };
    mockWebIdResource = { isLoading: () => false, reload: vi.fn().mockResolvedValue(undefined) };
    const { result } = renderHook(() => useDriveInitialization(500));
    expect(result.current.noStorageDetected).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(mockWebIdResource.reload).toHaveBeenCalled();
  });

  it('handleRetryStorage resets state and reloads resource', async () => {
    const { result } = renderHook(() => useDriveInitialization());
    await act(async () => {
      await result.current.handleRetryStorage();
    });
    expect(mockWebIdResource.reload).toHaveBeenCalled();
  });

  it('returns empty contacts when profile is null', () => {
    mockProfileValue = null;
    const { result } = renderHook(() => useDriveInitialization());
    expect(result.current.contacts).toEqual([]);
  });

  it('returns empty contacts when profile has no knows', () => {
    mockProfileValue = {
      storage: { toArray: () => [{ '@id': 'https://pod.example/' }] },
      knows: undefined,
    };
    const { result } = renderHook(() => useDriveInitialization());
    expect(result.current.contacts).toEqual([]);
  });

  it('handleRetryStorage returns early when webIdResource is not reloadable', async () => {
    // Remove reload method to make isReloadable return false
    mockWebIdResource = { isLoading: () => false };
    const { result } = renderHook(() => useDriveInitialization());
    await act(async () => {
      await result.current.handleRetryStorage();
    });
    // Since webIdResource has no reload method, isReloadable returns false, so reload is never called
    // No error should occur — the function just returns early
    expect(result.current.noStorageDetected).toBe(false);
  });

  it('handleNavigate pushes a new folder onto the breadcrumb trail and updates currentUri', () => {
    const { result } = renderHook(() => useDriveInitialization());
    act(() => {
      result.current.handleNavigate('https://pod.example/my-solid-app/photos/');
    });
    expect(result.current.currentUri).toBe('https://pod.example/my-solid-app/photos/');
    expect(result.current.breadcrumbs).toHaveLength(2);
    expect(result.current.breadcrumbs[1].uri).toBe('https://pod.example/my-solid-app/photos/');
    expect(result.current.breadcrumbs[1].label).toBe('photos');
  });

  it('handleBreadcrumbClick trims the breadcrumb trail and updates currentUri', () => {
    const { result } = renderHook(() => useDriveInitialization());
    act(() => {
      result.current.handleNavigate('https://pod.example/my-solid-app/photos/');
      result.current.handleNavigate('https://pod.example/my-solid-app/photos/vacation/');
    });
    expect(result.current.breadcrumbs).toHaveLength(3);

    act(() => {
      result.current.handleBreadcrumbClick(1, 'https://pod.example/my-solid-app/photos/' as import('@ldo/connected-solid').SolidContainerUri);
    });
    expect(result.current.currentUri).toBe('https://pod.example/my-solid-app/photos/');
    expect(result.current.breadcrumbs).toHaveLength(2);
    expect(result.current.breadcrumbs[1].uri).toBe('https://pod.example/my-solid-app/photos/');
  });
});

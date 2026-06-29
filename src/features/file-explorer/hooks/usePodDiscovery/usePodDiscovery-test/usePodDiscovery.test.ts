import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { StrictMode } from 'react';

let mockProfileValue: Record<string, unknown> | null = {
  storage: { toArray: () => [{ '@id': 'https://pod.example/' }] },
};
let mockWebIdResource: Record<string, unknown> = { isLoading: () => false };
const mockGetResource = vi.fn(() => ({}));
const mockSolidFetch = vi.fn();

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({
    session: { webId: 'https://pod.example/profile/card#me' },
    fetch: mockSolidFetch,
  }),
  useLdo: () => ({ getResource: mockGetResource }),
  useSubject: () => mockProfileValue,
  useResource: () => mockWebIdResource,
}));

const mockDiscoverStorageRoot = vi.fn();
vi.mock('@/infrastructure/solid/storageDiscovery', () => ({
  discoverStorageRoot: (...args: unknown[]) => mockDiscoverStorageRoot(...args),
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

import { usePodDiscovery } from '../usePodDiscovery-file/usePodDiscovery';

describe('usePodDiscovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockProfileValue = {
      storage: { toArray: () => [{ '@id': 'https://pod.example/' }] },
    };
    mockWebIdResource = { isLoading: () => false };
    mockGetResource.mockReturnValue({});
    mockDiscoverStorageRoot.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes appContainerUri, storageRootUri, noStorageDetected, handleRetryStorage, and initial navigation state', () => {
    const { result } = renderHook(() => usePodDiscovery(10000));
    expect(result.current).toHaveProperty('appContainerUri');
    expect(result.current).toHaveProperty('storageRootUri');
    expect(result.current).toHaveProperty('noStorageDetected');
    expect(result.current).toHaveProperty('handleRetryStorage');
    expect(result.current).toHaveProperty('initialCurrentUri');
    expect(result.current).toHaveProperty('initialBreadcrumbLabel');
  });

  it('discovers storage from profile', () => {
    const { result } = renderHook(() => usePodDiscovery(10000));
    expect(result.current.storageRootUri).toBe('https://pod.example/');
    expect(result.current.appContainerUri).toBe('https://pod.example/my-solid-app/');
    expect(result.current.initialCurrentUri).toBe('https://pod.example/');
  });

  it('sets breadcrumb label from translation', () => {
    const { result } = renderHook(() => usePodDiscovery(10000));
    expect(result.current.initialBreadcrumbLabel).toBe('fileExplorer.myPod');
  });

  it('noStorageDetected is false during pod discovery when storage exists', () => {
    const { result } = renderHook(() => usePodDiscovery(10000));
    expect(result.current.noStorageDetected).toBe(false);
  });

  it('creates app container when createIfAbsent available', () => {
    const mockCreate = vi.fn().mockResolvedValue(undefined);
    mockGetResource.mockReturnValue({ createIfAbsent: mockCreate });
    renderHook(() => usePodDiscovery(10000));
    expect(mockCreate).toHaveBeenCalled();
  });

  it('falls back to storage-root walk when profile has no pim:storage', async () => {
    mockProfileValue = { storage: { toArray: () => [] } };
    mockWebIdResource = { isLoading: () => false };
    mockDiscoverStorageRoot.mockResolvedValue('https://css.example/wse_pod/');
    const { result } = renderHook(() => usePodDiscovery(10000));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockDiscoverStorageRoot).toHaveBeenCalledWith(
      'https://pod.example/profile/card#me',
      mockSolidFetch,
    );
    expect(result.current.storageRootUri).toBe('https://css.example/wse_pod/');
    expect(result.current.appContainerUri).toBe('https://css.example/wse_pod/my-solid-app/');
    expect(result.current.noStorageDetected).toBe(false);
  });

  it('applies the discovered storage even when the hook re-renders mid-walk', async () => {
    mockProfileValue = { storage: { toArray: () => [] } };
    mockWebIdResource = { isLoading: () => false };
    let resolveWalk: (uri: string) => void = () => {};
    mockDiscoverStorageRoot.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveWalk = resolve;
      }),
    );

    const { result, rerender } = renderHook(() => usePodDiscovery(10000));

    mockProfileValue = { storage: { toArray: () => [] } };
    rerender();

    await act(async () => {
      resolveWalk('https://css.example/wse_pod/');
      await Promise.resolve();
    });

    expect(mockDiscoverStorageRoot).toHaveBeenCalledTimes(1);
    expect(result.current.storageRootUri).toBe('https://css.example/wse_pod/');
    expect(result.current.noStorageDetected).toBe(false);
  });

  it('applies the discovered storage under StrictMode double-invocation', async () => {
    mockProfileValue = { storage: { toArray: () => [] } };
    mockWebIdResource = { isLoading: () => false };
    let resolveWalk: (uri: string) => void = () => {};
    mockDiscoverStorageRoot.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveWalk = resolve;
      }),
    );

    const { result } = renderHook(() => usePodDiscovery(10000), {
      wrapper: StrictMode,
    });

    await act(async () => {
      resolveWalk('https://css.example/wse_pod/');
      await Promise.resolve();
    });

    expect(mockDiscoverStorageRoot).toHaveBeenCalledTimes(1);
    expect(result.current.storageRootUri).toBe('https://css.example/wse_pod/');
    expect(result.current.noStorageDetected).toBe(false);
  });

  it('ignores a walk that resolves after the hook unmounts', async () => {
    mockProfileValue = { storage: { toArray: () => [] } };
    mockWebIdResource = { isLoading: () => false };
    let resolveWalk: (uri: string) => void = () => {};
    mockDiscoverStorageRoot.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveWalk = resolve;
      }),
    );

    const { unmount } = renderHook(() => usePodDiscovery(10000));
    unmount();

    await act(async () => {
      resolveWalk('https://css.example/wse_pod/');
      await Promise.resolve();
    });

    expect(mockGetResource).not.toHaveBeenCalled();
  });

  it('sets noStorageDetected when profile has no storage and the walk finds none', async () => {
    mockProfileValue = { storage: { toArray: () => [] } };
    mockWebIdResource = { isLoading: () => false };
    mockDiscoverStorageRoot.mockResolvedValue(undefined);
    const { result } = renderHook(() => usePodDiscovery(10000));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.noStorageDetected).toBe(true);
  });

  it('does not set noStorageDetected during pod discovery when resource is still loading', () => {
    mockProfileValue = { storage: { toArray: () => [] } };
    mockWebIdResource = { isLoading: () => true };
    const { result } = renderHook(() => usePodDiscovery(10000));
    expect(result.current.noStorageDetected).toBe(false);
  });

  it('retry timer calls handleRetryStorage after delay', async () => {
    const mockReload = vi.fn().mockResolvedValue(undefined);
    mockProfileValue = { storage: { toArray: () => [] } };
    mockWebIdResource = { isLoading: () => false, reload: mockReload };
    mockDiscoverStorageRoot.mockResolvedValue(undefined);
    renderHook(() => usePodDiscovery(5000));

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockReload).toHaveBeenCalled();
  });

  it('handleRetryStorage resets state and reloads the webId resource', async () => {
    const mockReload = vi.fn().mockResolvedValue(undefined);
    mockWebIdResource = { isLoading: () => false, reload: mockReload };
    const { result } = renderHook(() => usePodDiscovery(10000));
    await act(async () => {
      await result.current.handleRetryStorage();
    });
    expect(mockReload).toHaveBeenCalled();
  });

  it('handleRetryStorage returns early when webIdResource is not reloadable', async () => {
    mockWebIdResource = { isLoading: () => false };
    const { result } = renderHook(() => usePodDiscovery(10000));
    await act(async () => {
      await result.current.handleRetryStorage();
    });
    // No error should be thrown and no state change should occur
    expect(result.current.noStorageDetected).toBe(false);
  });
});

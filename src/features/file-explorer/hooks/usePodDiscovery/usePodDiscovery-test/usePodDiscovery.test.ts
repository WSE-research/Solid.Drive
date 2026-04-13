import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

let mockProfileValue: Record<string, unknown> | null = {
  storage: { toArray: () => [{ '@id': 'https://pod.example/' }] },
};
let mockWebIdResource: Record<string, unknown> = { isLoading: () => false };
const mockGetResource = vi.fn(() => ({}));

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

  it('sets noStorageDetected during pod discovery when profile has no storage and resource done loading', () => {
    mockProfileValue = { storage: { toArray: () => [] } };
    mockWebIdResource = { isLoading: () => false };
    const { result } = renderHook(() => usePodDiscovery(10000));
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
    renderHook(() => usePodDiscovery(5000));

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
    // No error — just a no-op
    expect(result.current.noStorageDetected).toBe(false);
  });
});

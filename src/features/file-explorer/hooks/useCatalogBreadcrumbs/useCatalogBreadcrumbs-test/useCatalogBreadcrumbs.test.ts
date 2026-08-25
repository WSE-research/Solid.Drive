import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string, opts?: Record<string, unknown>) =>
    opts ? `${key}:${JSON.stringify(opts)}` : key],
}));

const mockShowError = vi.fn();
vi.mock('@/shared/contexts/NotificationContext', () => ({
  useNotifications: () => ({ showError: mockShowError, showSuccess: vi.fn() }),
}));

const mockResolveCatalogUri = vi.fn((..._args: unknown[]) => 'https://pod.example/catalog.ttl' as string | undefined);
vi.mock('@/infrastructure/solid/catalog', () => ({
  resolveCatalogUri: (...args: unknown[]) => mockResolveCatalogUri(...args),
}));

const fileEntry = { uri: 'https://pod.example/report/index.ttl', title: 'Report' };
const useCatalogDefaults = () => ({
  entries: [fileEntry],
  containerUris: new Set(['https://pod.example/report/']),
  folderTitles: new Map<string, string>(),
  folderIndex: new Map(),
  loading: false,
  error: null,
});
const mockUseCatalog = vi.fn(useCatalogDefaults);
vi.mock('@/features/file-explorer/hooks/useCatalog', () => ({
  useCatalog: () => mockUseCatalog(),
}));

const mockUseCatalogRootEntry = vi.fn((..._args: unknown[]) => 'succeeded' as 'pending' | 'succeeded' | 'failed');
vi.mock('@/features/file-explorer/hooks/useCatalogRootEntry', () => ({
  useCatalogRootEntry: (...args: unknown[]) => mockUseCatalogRootEntry(...args),
}));

const folderBreadcrumbsDefaults = () => ({
  breadcrumbs: [{ label: 'My Pod', uri: 'https://pod.example/' }],
  error: null as { atUri: string } | null,
});
const mockUseFolderBreadcrumbs = vi.fn((..._args: unknown[]) => folderBreadcrumbsDefaults());
vi.mock('@/features/file-explorer/hooks/useFolderBreadcrumbs', () => ({
  useFolderBreadcrumbs: (...args: unknown[]) => mockUseFolderBreadcrumbs(...args),
}));

import { useCatalogBreadcrumbs } from '../useCatalogBreadcrumbs-file/useCatalogBreadcrumbs';

const storageRootUri = 'https://pod.example/';
const currentUri = 'https://pod.example/docs/';
const profile = { catalog: { '@id': 'https://pod.example/catalog.ttl' } } as never;

describe('useCatalogBreadcrumbs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveCatalogUri.mockReturnValue('https://pod.example/catalog.ttl');
    mockUseCatalog.mockImplementation(useCatalogDefaults);
    mockUseCatalogRootEntry.mockReturnValue('succeeded');
    mockUseFolderBreadcrumbs.mockImplementation(folderBreadcrumbsDefaults);
  });

  it('resolves catalogUri from resolveCatalogUri(profile, storageRootUri)', () => {
    const { result } = renderHook(() =>
      useCatalogBreadcrumbs({ profile, storageRootUri, currentUri, rootLabel: 'My Pod' }),
    );
    expect(mockResolveCatalogUri).toHaveBeenCalledWith(profile, storageRootUri);
    expect(result.current.catalogUri).toBe('https://pod.example/catalog.ttl');
  });

  it('reports profileHasCatalog from the profile\'s own catalog link', () => {
    const { result: withCatalog } = renderHook(() =>
      useCatalogBreadcrumbs({ profile, storageRootUri, currentUri, rootLabel: 'My Pod' }),
    );
    expect(withCatalog.current.profileHasCatalog).toBe(true);

    const { result: withoutCatalog } = renderHook(() =>
      useCatalogBreadcrumbs({ profile: undefined, storageRootUri, currentUri, rootLabel: 'My Pod' }),
    );
    expect(withoutCatalog.current.profileHasCatalog).toBe(false);
  });

  it('passes through entries, containerUris, and folderTitles from useCatalog', () => {
    const { result } = renderHook(() =>
      useCatalogBreadcrumbs({ profile, storageRootUri, currentUri, rootLabel: 'My Pod' }),
    );
    expect(result.current.catalogEntries).toEqual([fileEntry]);
    expect(result.current.catalogContainerUris).toEqual(new Set(['https://pod.example/report/']));
  });

  it('treats the root as already present only once loading has settled and folderIndex has it', () => {
    mockUseCatalog.mockImplementation(() => ({
      ...useCatalogDefaults(),
      loading: false,
      folderIndex: new Map([[storageRootUri, { uri: storageRootUri, title: '', parentUri: '', conformsTo: '' }]]),
    }));
    renderHook(() => useCatalogBreadcrumbs({ profile, storageRootUri, currentUri, rootLabel: 'My Pod' }));
    expect(mockUseCatalogRootEntry).toHaveBeenCalledWith(
      'https://pod.example/catalog.ttl', storageRootUri, true,
    );
  });

  it('treats the root as not yet present while the catalog is still loading, even if folderIndex looks stale-populated', () => {
    mockUseCatalog.mockImplementation(() => ({
      ...useCatalogDefaults(),
      loading: true,
      folderIndex: new Map([[storageRootUri, { uri: storageRootUri, title: '', parentUri: '', conformsTo: '' }]]),
    }));
    renderHook(() => useCatalogBreadcrumbs({ profile, storageRootUri, currentUri, rootLabel: 'My Pod' }));
    expect(mockUseCatalogRootEntry).toHaveBeenCalledWith(
      'https://pod.example/catalog.ttl', storageRootUri, false,
    );
  });

  it('marks rootEntryFailed for useFolderBreadcrumbs only when the root registration write failed', () => {
    mockUseCatalogRootEntry.mockReturnValue('failed');
    renderHook(() => useCatalogBreadcrumbs({ profile, storageRootUri, currentUri, rootLabel: 'My Pod' }));
    expect(mockUseFolderBreadcrumbs).toHaveBeenCalledWith(
      expect.objectContaining({ rootEntryFailed: true }),
    );
  });

  it('returns the breadcrumbs from useFolderBreadcrumbs unchanged', () => {
    const { result } = renderHook(() =>
      useCatalogBreadcrumbs({ profile, storageRootUri, currentUri, rootLabel: 'My Pod' }),
    );
    expect(result.current.breadcrumbs).toEqual([{ label: 'My Pod', uri: storageRootUri }]);
  });

  it('shows an error toast naming the broken folder when useFolderBreadcrumbs reports one', () => {
    mockUseFolderBreadcrumbs.mockReturnValue({
      breadcrumbs: [{ label: 'My Pod', uri: storageRootUri }],
      error: { atUri: 'https://pod.example/docs/orphan/' },
    });
    renderHook(() => useCatalogBreadcrumbs({ profile, storageRootUri, currentUri, rootLabel: 'My Pod' }));
    expect(mockShowError).toHaveBeenCalledWith(
      expect.stringContaining('https://pod.example/docs/orphan/'),
    );
  });

  it('does not show a toast when there is no breadcrumb error', () => {
    renderHook(() => useCatalogBreadcrumbs({ profile, storageRootUri, currentUri, rootLabel: 'My Pod' }));
    expect(mockShowError).not.toHaveBeenCalled();
  });
});

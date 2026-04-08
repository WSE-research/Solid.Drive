import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mockFetch = vi.fn();
const mockProfileResource = { isLoading: () => false };
let mockProfileOverride: any = null;
const defaultProfile: any = {
  storage: { toArray: () => [{ '@id': 'https://contact.example/' }] },
  catalog: { '@id': 'https://contact.example/catalog.ttl' },
};

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ fetch: mockFetch }),
  useResource: () => mockProfileResource,
  useSubject: () => mockProfileOverride ?? defaultProfile,
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({
  SolidProfileShapeType: 'SolidProfileShapeType',
}));

const mockParseCatalog = vi.fn();
vi.mock('@/infrastructure/solid/catalog', () => ({
  parseCatalog: (...args: any[]) => mockParseCatalog(...args),
}));

const mockHasAccess = vi.fn();
vi.mock('@/infrastructure/solid/sharedCatalog', () => ({
  getAppContainerUri: (root: string) => `${root}my-solid-app/`,
  getCandidateSharedCatalogUris: () => ['https://contact.example/my-solid-app/.shared-viewer.ttl'],
  toContainerUri: (uri: string) => uri.replace(/[^/]+$/, ''),
  hasAccess: (...args: any[]) => mockHasAccess(...args),
}));

vi.mock('@/config', () => ({
  DEFAULT_FILE_TYPE_URI: 'http://schema.org/DigitalDocument',
}));

import { useSharedCatalog } from '../useSharedCatalog-file/useSharedCatalog';

describe('useSharedCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfileOverride = null;
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('') });
    mockParseCatalog.mockReturnValue([]);
    mockHasAccess.mockResolvedValue(false);
  });

  it('returns expected shape', () => {
    const { result } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );
    expect(result.current).toHaveProperty('sharedEntries');
    expect(result.current).toHaveProperty('typeGroups');
    expect(result.current).toHaveProperty('resolvedCatalogUri');
    expect(result.current).toHaveProperty('catalogAccessible');
    expect(result.current).toHaveProperty('isProfileLoading');
  });

  it('fetches shared catalog entries from per-contact catalog', async () => {
    const entries = [{ uri: 'https://contact.example/files/photo/index.ttl', title: 'Photo', conformsTo: '' }];
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('turtle') });
    mockParseCatalog.mockReturnValue(entries);

    const { result } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );

    await waitFor(() => {
      expect(result.current.sharedEntries.length).toBeGreaterThan(0);
    });
    expect(result.current.catalogAccessible).toBe(true);
    expect(result.current.resolvedCatalogUri).toContain('.shared-viewer');
  });

  it('sets catalogAccessible when per-contact catalog returns empty entries', async () => {
    // Per-contact catalog accessible but empty
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('empty') });
      }
      return Promise.resolve({ ok: false });
    });
    mockParseCatalog.mockReturnValue([]);

    const { result } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );

    await waitFor(() => {
      expect(result.current.catalogAccessible).toBe(true);
    });
    expect(result.current.sharedEntries).toEqual([]);
  });

  it('fetches main catalog and separates accessible vs browsable entries', async () => {
    const sharedEntries = [{ uri: 'https://contact.example/files/a/index.ttl', title: 'A', conformsTo: '' }];
    const mainEntries = [
      ...sharedEntries,
      { uri: 'https://contact.example/files/b/index.ttl', title: 'B', conformsTo: 'http://schema.org/ImageObject' },
      { uri: 'https://contact.example/files/c/index.ttl', title: 'C', conformsTo: '' },
    ];

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('shared') });
      }
      if (url === 'https://contact.example/catalog.ttl') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('main') });
      }
      return Promise.resolve({ ok: false });
    });
    mockParseCatalog.mockImplementation((_t: string, uri: string) => {
      if (uri.includes('.shared-viewer')) return sharedEntries;
      return mainEntries;
    });
    // B is accessible, C is not
    mockHasAccess.mockImplementation((uri: string) => {
      if (uri.includes('/b/')) return Promise.resolve(true);
      return Promise.resolve(false);
    });

    const { result } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );

    await waitFor(() => {
      // A (from shared) + B (recovered from main)
      expect(result.current.sharedEntries.length).toBe(2);
    });
    // C goes to type groups
    expect(result.current.typeGroups.size).toBe(1);
  });

  it('falls back to main catalog when per-contact catalogs fail', async () => {
    const mainEntries = [{ uri: 'https://contact.example/files/doc/index.ttl', title: 'Doc', conformsTo: '' }];

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer')) {
        return Promise.resolve({ ok: false });
      }
      if (url === 'https://contact.example/catalog.ttl') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('main') });
      }
      return Promise.resolve({ ok: false });
    });
    mockParseCatalog.mockReturnValue(mainEntries);

    const { result } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );

    await waitFor(() => {
      expect(result.current.sharedEntries.length).toBe(1);
    });
    expect(result.current.catalogAccessible).toBe(true);
    expect(result.current.resolvedCatalogUri).toBe('https://contact.example/catalog.ttl');
  });

  it('returns empty when no catalogs are accessible', async () => {
    mockFetch.mockResolvedValue({ ok: false });

    const { result } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(result.current.sharedEntries).toEqual([]);
    expect(result.current.catalogAccessible).toBe(false);
  });

  it('handles per-contact catalog fetch throwing an error', async () => {
    const mainEntries = [{ uri: 'https://contact.example/files/doc/index.ttl', title: 'Doc', conformsTo: '' }];

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer')) {
        return Promise.reject(new Error('network error'));
      }
      if (url === 'https://contact.example/catalog.ttl') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('main') });
      }
      return Promise.resolve({ ok: false });
    });
    mockParseCatalog.mockReturnValue(mainEntries);

    const { result } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );

    await waitFor(() => {
      expect(result.current.sharedEntries.length).toBe(1);
    });
  });

  it('isProfileLoading reflects resource state', () => {
    const { result } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );
    expect(typeof result.current.isProfileLoading).toBe('boolean');
  });

  it('handles main catalog fetch error when per-contact is accessible', async () => {
    // Per-contact accessible but main catalog throws
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('') });
      }
      if (url === 'https://contact.example/catalog.ttl') {
        return Promise.reject(new Error('main catalog error'));
      }
      return Promise.resolve({ ok: false });
    });
    mockParseCatalog.mockReturnValue([]);

    const { result } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );

    await waitFor(() => {
      expect(result.current.catalogAccessible).toBe(true);
    });
  });

  it('handles main catalog fallback throwing an error', async () => {
    // Per-contact catalogs fail (not accessible), main catalog also throws
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer')) {
        return Promise.resolve({ ok: false });
      }
      if (url === 'https://contact.example/catalog.ttl') {
        return Promise.reject(new Error('network error'));
      }
      return Promise.resolve({ ok: false });
    });

    const { result } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    // Should end up in the final cleanup (cancelled = false)
    expect(result.current.catalogAccessible).toBe(false);
    expect(result.current.sharedEntries).toEqual([]);
  });

  it('handles main catalog returning not-ok in fallback path', async () => {
    // Per-contact catalogs all return not-ok, main catalog also not-ok
    mockFetch.mockResolvedValue({ ok: false });

    const { result } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(result.current.catalogAccessible).toBe(false);
    expect(result.current.resolvedCatalogUri).toBeNull();
  });

  it('handles main catalog returning ok but empty entries in fallback path', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer')) {
        return Promise.resolve({ ok: false });
      }
      if (url === 'https://contact.example/catalog.ttl') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('empty') });
      }
      return Promise.resolve({ ok: false });
    });
    mockParseCatalog.mockReturnValue([]);

    const { result } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    // Empty parsed entries → doesn't set catalogAccessible
    expect(result.current.catalogAccessible).toBe(false);
  });

  it('uses storage fallback from profileDocUri when profile has no storage triple', async () => {
    // Profile with empty storage array → falls back to profileDocUri.replace(...)
    mockProfileOverride = {
      storage: { toArray: () => [] },
      catalog: null,
    };
    const mainEntries = [{ uri: 'https://contact.example/files/doc/index.ttl', title: 'Doc', conformsTo: '' }];

    mockFetch.mockImplementation((url: string) => {
      // The fallback storageRoot is 'https://contact.example/' (from replacing /profile/card)
      // So catalog would be 'https://contact.example/catalog.ttl'
      if (url.includes('catalog.ttl')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('main') });
      }
      return Promise.resolve({ ok: false });
    });
    mockParseCatalog.mockReturnValue(mainEntries);

    const { result } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );

    await waitFor(() => {
      expect(result.current.sharedEntries.length).toBe(1);
    });
    expect(result.current.catalogAccessible).toBe(true);
  });
});

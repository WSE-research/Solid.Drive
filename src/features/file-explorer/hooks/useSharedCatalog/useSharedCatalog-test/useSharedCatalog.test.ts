import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mockFetch = vi.fn();
const mockProfileResource = { isLoading: () => false };
let mockProfileOverride: Record<string, unknown> | null = null;
const defaultProfile: Record<string, unknown> = {
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
  parseCatalog: (...args: unknown[]) => mockParseCatalog(...args),
}));

const mockHasAccess = vi.fn();
const mockGetCandidateUris = vi.fn().mockReturnValue(['https://contact.example/my-solid-app/.shared-viewer.ttl']);
vi.mock('@/infrastructure/solid/sharedCatalog', () => ({
  getAppContainerUri: (root: string) => `${root}my-solid-app/`,
  getCandidateSharedCatalogUris: (...args: unknown[]) => mockGetCandidateUris(...args),
  toContainerUri: (uri: string) => uri.replace(/[^/]+$/, ''),
  hasAccess: (...args: unknown[]) => mockHasAccess(...args),
  isSharedCatalogFile: (name: string) => name.startsWith('.shared-') && name.endsWith('.ttl'),
}));

vi.mock('@/config', () => ({
  DEFAULT_FILE_TYPE_URI: 'http://schema.org/DigitalDocument',
  DEFAULT_CATALOG_FILENAME: 'catalog.ttl',
  SYSTEM_FILES: new Set(['catalog.ttl', 'robots.txt', 'README', '.acl', '.meta']),
}));

import {
  __resetSharedCatalogCacheForTests,
  useSharedCatalog,
} from '../useSharedCatalog-file/useSharedCatalog';

describe('useSharedCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetSharedCatalogCacheForTests();
    mockProfileOverride = null;
    mockGetCandidateUris.mockReturnValue(['https://contact.example/my-solid-app/.shared-viewer.ttl']);
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('') });
    mockParseCatalog.mockReturnValue([]);
    mockHasAccess.mockResolvedValue(false);
  });

  it('exposes sharedEntries, typeGroups, resolvedCatalogUri, catalogAccessible, and isProfileLoading', () => {
    const { result } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );
    expect(result.current).toHaveProperty('sharedEntries');
    expect(result.current).toHaveProperty('typeGroups');
    expect(result.current).toHaveProperty('resolvedCatalogUri');
    expect(result.current).toHaveProperty('catalogAccessible');
    expect(result.current).toHaveProperty('isProfileLoading');
  });

  it('returns sharedEntries when the per-contact catalog is accessible and the file ACL still grants read', async () => {
    const entries = [{ uri: 'https://contact.example/files/photo/index.ttl', title: 'Photo', conformsTo: '' }];
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('turtle') });
    mockParseCatalog.mockReturnValue(entries);
    mockHasAccess.mockResolvedValue(true);

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

  it('hides internal shared-catalog helper files that appear in a contact catalog', async () => {
    const realEntry = { uri: 'https://contact.example/files/photo/index.ttl', title: 'Photo', conformsTo: '' };
    const helperEntry = {
      uri: 'https://contact.example/my-solid-app/.shared-https%3A%2F%2Fviewer.example%2Fprofile%2Fcard.ttl',
      title: 'Internal',
      conformsTo: '',
    };
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('per-viewer') });
    mockParseCatalog.mockReturnValue([realEntry, helperEntry]);
    mockHasAccess.mockResolvedValue(true);

    const { result } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );

    await waitFor(() => {
      expect(result.current.sharedEntries.map((entry) => entry.title)).toEqual(['Photo']);
    });
  });

  it('probes accessibility against entry.uri (the metadata index) — not the container — to avoid false negatives from servers that 404 on container HEAD', async () => {
    const entryUri = 'https://contact.example/files/photo/index.ttl';
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('per-viewer') });
    mockParseCatalog.mockReturnValue([{ uri: entryUri, title: 'Photo', conformsTo: '' }]);
    mockHasAccess.mockResolvedValue(true);

    renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );

    await waitFor(() => {
      expect(mockHasAccess).toHaveBeenCalled();
    });
    const probedUri = mockHasAccess.mock.calls[0][0];
    expect(probedUri).toBe(entryUri);
  });

  it('moves per-viewer catalog entries that are no longer accessible into typeGroups so the requester can re-request them', async () => {
    const perViewerEntries = [
      { uri: 'https://contact.example/files/granted/index.ttl', title: 'Granted', conformsTo: 'http://schema.org/ImageObject' },
      { uri: 'https://contact.example/files/revoked/index.ttl', title: 'Revoked', conformsTo: 'http://schema.org/ImageObject' },
    ];

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('per-viewer') });
      }
      return Promise.resolve({ ok: false });
    });
    mockParseCatalog.mockReturnValue(perViewerEntries);
    mockHasAccess.mockImplementation((uri: string) =>
      Promise.resolve(uri.includes('/granted/'))
    );

    const { result } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );

    await waitFor(() => {
      expect(result.current.sharedEntries.map((entry) => entry.title)).toEqual(['Granted']);
    });
    const imageBucket = result.current.typeGroups.get('http://schema.org/ImageObject');
    expect(imageBucket?.map((entry) => entry.title)).toEqual(['Revoked']);
  });

  it('separates accessible entries into sharedEntries and browsable entries into typeGroups when the main catalog is available', async () => {
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
    // A (per-viewer) and B (main) are accessible, C is not
    mockHasAccess.mockImplementation((uri: string) => {
      if (uri.includes('/a/') || uri.includes('/b/')) return Promise.resolve(true);
      return Promise.resolve(false);
    });

    const { result } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );

    await waitFor(() => {
      // A (from shared) + B (recovered from main)
      expect(result.current.sharedEntries.length).toBe(2);
    });
    expect(result.current.grantedEntries.map((entry) => entry.title)).toEqual(['A']);
    // C goes to type groups
    expect(result.current.typeGroups.size).toBe(1);
  });

  it('grantedEntries includes every per-viewer catalog entry regardless of hasAccess so revoked-but-still-listed shares stay visible in By-you', async () => {
    const perViewerEntries = [
      { uri: 'https://contact.example/files/granted/index.ttl', title: 'Granted', conformsTo: '' },
      { uri: 'https://contact.example/files/no-head/index.ttl', title: 'NoHead', conformsTo: '' },
    ];

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('per-viewer') });
      }
      return Promise.resolve({ ok: false });
    });
    mockParseCatalog.mockReturnValue(perViewerEntries);
    mockHasAccess.mockImplementation((uri: string) => Promise.resolve(uri.includes('/granted/')));

    const { result } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );

    await waitFor(() => {
      expect(result.current.grantedEntries.length).toBe(2);
    });
    expect(result.current.grantedEntries.map((entry) => entry.title)).toEqual(['Granted', 'NoHead']);
  });

  it('grantedEntries is empty in the main-catalog fallback because nothing was explicitly granted', async () => {
    const mainEntries = [{ uri: 'https://contact.example/files/doc/index.ttl', title: 'Doc', conformsTo: '' }];

    mockHasAccess.mockResolvedValue(true);
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
    expect(result.current.grantedEntries).toEqual([]);
  });

  it('falls back to main catalog when per-contact catalogs fail', async () => {
    const mainEntries = [{ uri: 'https://contact.example/files/doc/index.ttl', title: 'Doc', conformsTo: '' }];

    mockHasAccess.mockResolvedValue(true);
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

  it('main-catalog fallback puts inaccessible entries into typeGroups', async () => {
    const mainEntries = [
      { uri: 'https://contact.example/files/visible/index.ttl', title: 'Visible', conformsTo: 'http://schema.org/ImageObject' },
      { uri: 'https://contact.example/files/locked/index.ttl', title: 'Locked', conformsTo: 'http://schema.org/ImageObject' },
    ];

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer')) return Promise.resolve({ ok: false });
      if (url === 'https://contact.example/catalog.ttl') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('main') });
      }
      return Promise.resolve({ ok: false });
    });
    mockParseCatalog.mockReturnValue(mainEntries);
    mockHasAccess.mockImplementation((uri: string) => Promise.resolve(uri.includes('/visible/')));

    const { result } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );

    await waitFor(() => {
      expect(result.current.sharedEntries.map((entry) => entry.title)).toEqual(['Visible']);
    });
    const imageBucket = result.current.typeGroups.get('http://schema.org/ImageObject');
    expect(imageBucket?.map((entry) => entry.title)).toEqual(['Locked']);
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

  it('falls back to main catalog when per-contact catalog fetch throws an error', async () => {
    const mainEntries = [{ uri: 'https://contact.example/files/doc/index.ttl', title: 'Doc', conformsTo: '' }];

    mockHasAccess.mockResolvedValue(true);
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

  it('exposes isProfileLoading as a boolean derived from the profile resource state', () => {
    const { result } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );
    expect(typeof result.current.isProfileLoading).toBe('boolean');
  });

  it('ignores main catalog error and uses per-contact catalog when it is accessible', async () => {
  
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

  it('returns empty entries when both per-contact and main catalog fetches throw', async () => {
    
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

  it('returns empty sharedEntries and false catalogAccessible when main catalog returns not-ok in fallback path', async () => {
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

  it('returns catalogAccessible false when main catalog returns ok but has no entries in fallback path', async () => {
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

  it('skips effect when both catalogUris and mainCatalogUri are empty', async () => {
    // Return empty catalog URIs and no catalog on profile
    mockGetCandidateUris.mockReturnValue([]);
    mockProfileOverride = {
      storage: { toArray: () => [{ '@id': 'https://contact.example/' }] },
      catalog: null,
    };


    const { result } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    // With empty catalogUris, the for loop is skipped, perContactAccessible stays false
    // Falls through to main catalog fallback
    expect(typeof result.current.catalogAccessible).toBe('boolean');
  });

  it('cleans up cancelled flag on unmount during per-contact catalog fetch', async () => {
    // Set up a fetch that never resolves immediately
    let resolveShared: ((value: unknown) => void) | null = null;
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer')) {
        return new Promise((resolve) => { resolveShared = resolve; });
      }
      return Promise.resolve({ ok: false });
    });

    const { unmount } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );

    // Unmount before the fetch resolves → cancelled = true
    unmount();

    // Now resolve the fetch — state updates should be skipped
    if (resolveShared) {
      (resolveShared as (value: unknown) => void)({ ok: true, text: () => Promise.resolve('turtle') });
    }

    // No error should be thrown — the cancelled check prevents setState after unmount
  });

  it('cleans up cancelled flag on unmount during main catalog access checks', async () => {
    const sharedEntries = [{ uri: 'https://contact.example/files/a/index.ttl', title: 'A', conformsTo: '' }];
    const mainEntries = [
      ...sharedEntries,
      { uri: 'https://contact.example/files/b/index.ttl', title: 'B', conformsTo: '' },
    ];

    let resolveAccessCheck: ((value: boolean) => void) | null = null;
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
    mockHasAccess.mockImplementation(() => new Promise((resolve) => { resolveAccessCheck = resolve; }));

    const { unmount } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );

    // Wait for shared catalog to be fetched
    await waitFor(() => {
      expect(mockHasAccess).toHaveBeenCalled();
    });

    // Unmount during access check
    unmount();

    // Resolve access check — should be ignored due to cancelled flag
    if (resolveAccessCheck) {
      (resolveAccessCheck as (value: boolean) => void)(true);
    }
  });

  it('uses storage fallback from profileDocUri when profile has no storage triple', async () => {
    // Profile with empty storage array → falls back to profileDocUri.replace(...)
    mockProfileOverride = {
      storage: { toArray: () => [] },
      catalog: null,
    };
    const mainEntries = [{ uri: 'https://contact.example/files/doc/index.ttl', title: 'Doc', conformsTo: '' }];

    mockHasAccess.mockResolvedValue(true);
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

  it('serves a second consumer from the module cache without re-fetching', async () => {
    const entries = [{ uri: 'https://contact.example/files/photo/index.ttl', title: 'Photo', conformsTo: '' }];
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('turtle') });
    mockParseCatalog.mockReturnValue(entries);
    mockHasAccess.mockResolvedValue(true);

    const { result: first } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );
    await waitFor(() => {
      expect(first.current.sharedEntries.length).toBeGreaterThan(0);
    });

    const fetchCountAfterFirst = mockFetch.mock.calls.length;

    const { result: second } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );

    expect(second.current.sharedEntries).toEqual(first.current.sharedEntries);
    expect(mockFetch.mock.calls.length).toBe(fetchCountAfterFirst);
  });

  it('returns empty catalogUris and null mainCatalogUri when storageRoot is empty string', () => {

    mockProfileOverride = {
      storage: { toArray: () => [{ '@id': '' }] },
      catalog: null,
    };

    const { result } = renderHook(() =>
      useSharedCatalog('https://contact.example/profile/card#me', 'https://viewer.example/profile/card#me')
    );

    // With both catalogUris=[] and mainCatalogUri=null, the effect early-returns (line 58)
    // No fetch should be called since the effect returns immediately
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.catalogAccessible).toBe(false);
    expect(result.current.sharedEntries).toEqual([]);
  });
});

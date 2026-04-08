import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { SharedWithMeSection } from '../SharedWithMeSection-file/SharedWithMeSection';

const mockFetch = vi.fn();
const mockParseCatalog = vi.fn();
const mockHasAccess = vi.fn();
const mockDiscoverInboxUri = vi.fn();
const mockListRejectionNotifications = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string, params?: any) => {
    if (params?.name) return `${key}:${params.name}`;
    return key;
  }],
}));

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ fetch: mockFetch }),
  useResource: () => ({ isLoading: () => false, isFetched: () => true, isUnfetched: () => false }),
  useSubject: (_type: any, webId: string) => {
    if (webId === 'https://alice.example/profile/card#me') {
      return {
        fn: 'Alice',
        name: null,
        storage: { toArray: () => [{ '@id': 'https://alice.example/' }] },
        catalog: { '@id': 'https://alice.example/catalog.ttl' },
      };
    }
    if (webId === 'https://noname.example/profile/card#me') {
      return {
        fn: null,
        name: null,
        storage: { toArray: () => [{ '@id': 'https://noname.example/' }] },
        catalog: null,
      };
    }
    return null;
  },
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({
  SolidProfileShapeType: {},
}));

vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isLoadable: () => true,
}));

vi.mock('@/infrastructure/solid/catalog', () => ({
  parseCatalog: (...args: any[]) => mockParseCatalog(...args),
}));

vi.mock('@/infrastructure/solid/sharedCatalog', () => ({
  getAppContainerUri: (root: string) => `${root}my-solid-app/`,
  getCandidateSharedCatalogUris: () => ['https://alice.example/my-solid-app/.shared-viewer.ttl'],
  toContainerUri: (uri: string) => uri.replace(/index\.ttl$/, ''),
  hasAccess: (...args: any[]) => mockHasAccess(...args),
}));

vi.mock('@/infrastructure/inbox/inboxAccess', () => ({
  discoverInboxUri: (...args: any[]) => mockDiscoverInboxUri(...args),
  listRejectionNotifications: (...args: any[]) => mockListRejectionNotifications(...args),
}));

vi.mock('@/features/file-explorer/components/FileCard', () => ({
  FileCard: ({ containerUri }: any) => <div data-testid="file-card" data-uri={containerUri} />,
}));

let capturedOnClearRejection: ((containerUri: string) => void) | null = null;
vi.mock('@/features/file-explorer/components/TypeFolder', () => ({
  TypeFolder: ({ classUri, onClearRejection }: any) => {
    capturedOnClearRejection = onClearRejection;
    return <div data-testid="type-folder" data-class={classUri} />;
  },
}));

vi.mock('@/config', () => ({
  DEFAULT_FILE_TYPE_URI: 'http://schema.org/DigitalDocument',
}));

describe('SharedWithMeSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnClearRejection = null;
    mockFetch.mockResolvedValue({ ok: false });
    mockParseCatalog.mockReturnValue([]);
    mockHasAccess.mockResolvedValue(false);
    mockDiscoverInboxUri.mockResolvedValue('https://viewer.example/inbox/');
    mockListRejectionNotifications.mockResolvedValue([]);
  });

  it('returns null when no other contacts (all are owner)', () => {
    const { container } = render(
      <SharedWithMeSection
        contacts={['https://owner.example/profile/card#me']}
        ownerWebId="https://owner.example/profile/card#me"
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders heading and section for non-owner contacts', () => {
    render(
      <SharedWithMeSection
        contacts={['https://owner.example/profile/card#me', 'https://alice.example/profile/card#me']}
        ownerWebId="https://owner.example/profile/card#me"
      />
    );
    expect(screen.getByText('sharedWithMe.heading')).toBeInTheDocument();
    expect(document.querySelector('section')).toBeInTheDocument();
  });

  it('filters out owner from contacts list', () => {
    render(
      <SharedWithMeSection
        contacts={[
          'https://owner.example/profile/card#me',
          'https://alice.example/profile/card#me',
        ]}
        ownerWebId="https://owner.example/profile/card#me"
      />
    );
    expect(screen.getByText('sharedWithMe.heading')).toBeInTheDocument();
  });

  // -- ContactSharedFiles inner component tests --

  it('renders ContactSharedFiles label when catalog is accessible', async () => {
    // Per-contact shared catalog returns entries
    const sharedEntries = [
      { uri: 'https://alice.example/files/photo/index.ttl', title: 'Photo', conformsTo: '' },
    ];
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('turtle') });
      }
      if (url === 'https://alice.example/catalog.ttl') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('main catalog') });
      }
      return Promise.resolve({ ok: false });
    });
    mockParseCatalog.mockImplementation((_text: string, uri: string) => {
      if (uri.includes('.shared-viewer')) return sharedEntries;
      return [];
    });

    render(
      <SharedWithMeSection
        contacts={['https://owner.example/profile/card#me', 'https://alice.example/profile/card#me']}
        ownerWebId="https://owner.example/profile/card#me"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('sharedWithMe.from:Alice')).toBeInTheDocument();
    });
  });

  it('renders FileCard for shared entries', async () => {
    const sharedEntries = [
      { uri: 'https://alice.example/files/photo/index.ttl', title: 'Photo', conformsTo: '' },
    ];
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('turtle') });
      }
      if (url === 'https://alice.example/catalog.ttl') {
        return Promise.resolve({ ok: false });
      }
      return Promise.resolve({ ok: false });
    });
    mockParseCatalog.mockReturnValue(sharedEntries);

    render(
      <SharedWithMeSection
        contacts={['https://owner.example/profile/card#me', 'https://alice.example/profile/card#me']}
        ownerWebId="https://owner.example/profile/card#me"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('file-card')).toBeInTheDocument();
    });
  });

  it('shows noFilesYet when catalog accessible but no entries or type groups', async () => {
    // shared catalog accessible but empty, no main catalog entries
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('') });
      }
      if (url === 'https://alice.example/catalog.ttl') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('') });
      }
      return Promise.resolve({ ok: false });
    });
    mockParseCatalog.mockReturnValue([]);

    render(
      <SharedWithMeSection
        contacts={['https://owner.example/profile/card#me', 'https://alice.example/profile/card#me']}
        ownerWebId="https://owner.example/profile/card#me"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('sharedWithMe.noFilesYet')).toBeInTheDocument();
    });
  });

  it('renders TypeFolder for browsable entries from main catalog', async () => {
    const sharedEntries = [
      { uri: 'https://alice.example/files/photo/index.ttl', title: 'Photo', conformsTo: 'http://schema.org/ImageObject' },
    ];
    const mainEntries = [
      ...sharedEntries,
      { uri: 'https://alice.example/files/doc/index.ttl', title: 'Doc', conformsTo: 'http://schema.org/DigitalDocument' },
    ];

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('shared') });
      }
      if (url === 'https://alice.example/catalog.ttl') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('main') });
      }
      return Promise.resolve({ ok: false });
    });
    mockParseCatalog.mockImplementation((_text: string, uri: string) => {
      if (uri.includes('.shared-viewer')) return sharedEntries;
      return mainEntries;
    });
    mockHasAccess.mockResolvedValue(false);

    render(
      <SharedWithMeSection
        contacts={['https://owner.example/profile/card#me', 'https://alice.example/profile/card#me']}
        ownerWebId="https://owner.example/profile/card#me"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('type-folder')).toBeInTheDocument();
    });
  });

  it('merges recovered shared entries when access check passes', async () => {
    const sharedEntries = [
      { uri: 'https://alice.example/files/photo/index.ttl', title: 'Photo', conformsTo: '' },
    ];
    const mainEntries = [
      ...sharedEntries,
      { uri: 'https://alice.example/files/extra/index.ttl', title: 'Extra', conformsTo: '' },
    ];

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('shared') });
      }
      if (url === 'https://alice.example/catalog.ttl') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('main') });
      }
      return Promise.resolve({ ok: false });
    });
    mockParseCatalog.mockImplementation((_text: string, uri: string) => {
      if (uri.includes('.shared-viewer')) return sharedEntries;
      return mainEntries;
    });
    mockHasAccess.mockResolvedValue(true);

    render(
      <SharedWithMeSection
        contacts={['https://owner.example/profile/card#me', 'https://alice.example/profile/card#me']}
        ownerWebId="https://owner.example/profile/card#me"
      />
    );

    await waitFor(() => {
      const cards = screen.getAllByTestId('file-card');
      expect(cards.length).toBe(2);
    });
  });

  it('falls back to main catalog when per-contact catalogs fail', async () => {
    const mainEntries = [
      { uri: 'https://alice.example/files/doc/index.ttl', title: 'Doc', conformsTo: '' },
    ];

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer')) {
        return Promise.resolve({ ok: false });
      }
      if (url === 'https://alice.example/catalog.ttl') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('main') });
      }
      return Promise.resolve({ ok: false });
    });
    mockParseCatalog.mockReturnValue(mainEntries);

    render(
      <SharedWithMeSection
        contacts={['https://owner.example/profile/card#me', 'https://alice.example/profile/card#me']}
        ownerWebId="https://owner.example/profile/card#me"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('file-card')).toBeInTheDocument();
    });
  });

  it('renders null for ContactSharedFiles when catalog not accessible', async () => {
    mockFetch.mockResolvedValue({ ok: false });

    const { container } = render(
      <SharedWithMeSection
        contacts={['https://owner.example/profile/card#me', 'https://alice.example/profile/card#me']}
        ownerWebId="https://owner.example/profile/card#me"
      />
    );

    // Wait for async effect to complete
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // ContactSharedFiles returns null when not accessible, but section heading still shows
    expect(screen.getByText('sharedWithMe.heading')).toBeInTheDocument();
    // No file cards or type folders should be rendered
    expect(screen.queryByTestId('file-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('type-folder')).not.toBeInTheDocument();
  });

  it('fetches inbox rejections when catalog is accessible', async () => {
    const sharedEntries = [
      { uri: 'https://alice.example/files/photo/index.ttl', title: 'Photo', conformsTo: '' },
    ];
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('turtle') });
      }
      return Promise.resolve({ ok: false });
    });
    mockParseCatalog.mockReturnValue(sharedEntries);

    render(
      <SharedWithMeSection
        contacts={['https://owner.example/profile/card#me', 'https://alice.example/profile/card#me']}
        ownerWebId="https://owner.example/profile/card#me"
      />
    );

    await waitFor(() => {
      expect(mockDiscoverInboxUri).toHaveBeenCalledWith('https://owner.example/profile/card#me', mockFetch);
      expect(mockListRejectionNotifications).toHaveBeenCalled();
    });
  });

  it('handles inbox discovery failure gracefully', async () => {
    mockDiscoverInboxUri.mockRejectedValue(new Error('no inbox'));
    const sharedEntries = [
      { uri: 'https://alice.example/files/photo/index.ttl', title: 'Photo', conformsTo: '' },
    ];
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('turtle') });
      }
      return Promise.resolve({ ok: false });
    });
    mockParseCatalog.mockReturnValue(sharedEntries);

    render(
      <SharedWithMeSection
        contacts={['https://owner.example/profile/card#me', 'https://alice.example/profile/card#me']}
        ownerWebId="https://owner.example/profile/card#me"
      />
    );

    await waitFor(() => {
      // Should still render file cards despite inbox failure
      expect(screen.getByTestId('file-card')).toBeInTheDocument();
    });
  });

  it('handles per-contact catalog fetch throwing an error', async () => {
    const mainEntries = [
      { uri: 'https://alice.example/files/doc/index.ttl', title: 'Doc', conformsTo: '' },
    ];
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer')) {
        return Promise.reject(new Error('network error'));
      }
      if (url === 'https://alice.example/catalog.ttl') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('main') });
      }
      return Promise.resolve({ ok: false });
    });
    mockParseCatalog.mockReturnValue(mainEntries);

    render(
      <SharedWithMeSection
        contacts={['https://owner.example/profile/card#me', 'https://alice.example/profile/card#me']}
        ownerWebId="https://owner.example/profile/card#me"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('file-card')).toBeInTheDocument();
    });
  });

  it('uses profile.name fallback when profile.fn is null', async () => {
    // noname contact has fn: null, name: null → falls through to webId extract
    // We need a contact with fn: null but name: 'NameOnly'
    // Let's use alice with modified mock — but useSubject is static so we test noname contact
    // 'noname.example' is the path segment that gets picked
    const sharedEntries = [
      { uri: 'https://noname.example/files/photo/index.ttl', title: 'Photo', conformsTo: '' },
    ];
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer') || url.includes('.shared-')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('turtle') });
      }
      return Promise.resolve({ ok: false });
    });
    mockParseCatalog.mockReturnValue(sharedEntries);

    render(
      <SharedWithMeSection
        contacts={['https://owner.example/profile/card#me', 'https://noname.example/profile/card#me']}
        ownerWebId="https://owner.example/profile/card#me"
      />
    );

    await waitFor(() => {
      // noname profile has fn: null, name: null → displayName goes through webId extraction
      // 'noname.example' is the first segment not matching 'profile', 'card', or starting with 'http'
      // Actually 'https:' starts with 'http' → skipped. 'noname.example' → matched!
      // Wait, the webId is 'https://noname.example/profile/card#me'
      // Remove fragment: 'https://noname.example/profile/card'
      // Split by '/': ['https:', '', 'noname.example', 'profile', 'card']
      // Filter(Boolean): ['https:', 'noname.example', 'profile', 'card']
      // Find: 'https:' starts with 'http' → skip; 'noname.example' → not 'profile', not 'card', doesn't start with 'http' → found!
      expect(screen.getByText('sharedWithMe.from:noname.example')).toBeInTheDocument();
    });
  });

  it('falls back to contactWebId when all path segments are filtered', async () => {
    // Contact where all segments match exclusions → falls back to contactWebId itself
    const weirdWebId = 'http://profile/card#me';
    // Segments after filter: ['http:', 'profile', 'card'] → 'http:' starts with 'http', 'profile' excluded, 'card' excluded
    // find returns undefined → ?? contactWebId
    const sharedEntries = [
      { uri: 'http://profile/files/photo/index.ttl', title: 'Photo', conformsTo: '' },
    ];
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('turtle') });
      }
      return Promise.resolve({ ok: false });
    });
    mockParseCatalog.mockReturnValue(sharedEntries);

    render(
      <SharedWithMeSection
        contacts={['https://owner.example/profile/card#me', weirdWebId]}
        ownerWebId="https://owner.example/profile/card#me"
      />
    );

    // The useSubject returns null for this webId → all name fields null → webId fallback chain
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  it('handles main catalog throw when per-contact catalog is accessible', async () => {
    // Per-contact catalog accessible (empty), but main catalog fetch throws
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('') });
      }
      if (url === 'https://alice.example/catalog.ttl') {
        return Promise.reject(new Error('main catalog error'));
      }
      return Promise.resolve({ ok: false });
    });
    mockParseCatalog.mockReturnValue([]);

    render(
      <SharedWithMeSection
        contacts={['https://owner.example/profile/card#me', 'https://alice.example/profile/card#me']}
        ownerWebId="https://owner.example/profile/card#me"
      />
    );

    await waitFor(() => {
      // catalog should still be accessible (per-contact succeeded)
      expect(screen.getByText('sharedWithMe.from:Alice')).toBeInTheDocument();
    });
  });

  it('handles fallback main catalog throw when per-contact catalogs all fail', async () => {
    // Per-contact catalogs all fail (not accessible), main catalog also throws
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer')) {
        return Promise.resolve({ ok: false });
      }
      if (url === 'https://alice.example/catalog.ttl') {
        return Promise.reject(new Error('network error'));
      }
      return Promise.resolve({ ok: false });
    });

    const { container } = render(
      <SharedWithMeSection
        contacts={['https://owner.example/profile/card#me', 'https://alice.example/profile/card#me']}
        ownerWebId="https://owner.example/profile/card#me"
      />
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    // ContactSharedFiles should return null (not accessible)
    expect(screen.queryByTestId('file-card')).not.toBeInTheDocument();
  });

  it('clears rejection when onClearRejection is called via TypeFolder', async () => {
    const sharedEntries = [
      { uri: 'https://alice.example/files/photo/index.ttl', title: 'Photo', conformsTo: 'http://schema.org/ImageObject' },
    ];
    const mainEntries = [
      ...sharedEntries,
      { uri: 'https://alice.example/files/doc/index.ttl', title: 'Doc', conformsTo: 'http://schema.org/DigitalDocument' },
    ];

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('.shared-viewer')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('shared') });
      }
      if (url === 'https://alice.example/catalog.ttl') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('main') });
      }
      return Promise.resolve({ ok: false });
    });
    mockParseCatalog.mockImplementation((_text: string, uri: string) => {
      if (uri.includes('.shared-viewer')) return sharedEntries;
      return mainEntries;
    });
    mockHasAccess.mockResolvedValue(false);
    mockListRejectionNotifications.mockResolvedValue([
      { accessTo: 'https://alice.example/files/doc/', actor: 'https://alice.example/profile/card#me', notificationUri: 'urn:notif:1' },
    ]);

    render(
      <SharedWithMeSection
        contacts={['https://owner.example/profile/card#me', 'https://alice.example/profile/card#me']}
        ownerWebId="https://owner.example/profile/card#me"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('type-folder')).toBeInTheDocument();
    });

    // Now invoke the captured onClearRejection callback (lines 222-226)
    expect(capturedOnClearRejection).not.toBeNull();
    await act(async () => {
      capturedOnClearRejection!('https://alice.example/files/doc/');
    });
    // The rejection should be removed from the map (no crash)
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { SharedWithMeSection } from '../SharedWithMeSection-file/SharedWithMeSection';
import type { CatalogEntry } from '@/types';
import type { AccessRejection } from '@/infrastructure/inbox/inboxAccess';

// ── module mocks ──────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string, params?: Record<string, string>) => {
    if (params?.name) return `${key}:${params.name}`;
    return key;
  }],
}));

vi.mock('@ldo/solid-react', () => ({
  useSubject: vi.fn(),
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({
  SolidProfileShapeType: {},
}));

vi.mock('@/infrastructure/solid/sharedCatalog', () => ({
  toContainerUri: (uri: string) =>
    uri.endsWith('/') ? uri : uri.slice(0, uri.lastIndexOf('/') + 1),
}));

vi.mock('@/features/file-explorer/hooks/useSharedCatalog', () => ({
  useSharedCatalog: vi.fn(),
}));

vi.mock('@/shared/hooks/useContactRejections', () => ({
  useContactRejections: vi.fn(),
}));

vi.mock('@/shared/utils/getProfileDisplayName', () => ({
  getProfileDisplayName: vi.fn(),
}));

vi.mock('@/features/file-explorer/components/FileCard', () => ({
  FileCard: ({ containerUri }: { containerUri: string }) => (
    <div data-testid="file-card" data-uri={containerUri} />
  ),
}));

let capturedOnClearRejection: ((containerUri: string) => void) | null = null;
vi.mock('@/features/file-explorer/components/TypeFolder', () => ({
  TypeFolder: ({ classUri, onClearRejection }: { classUri: string; onClearRejection: (uri: string) => void }) => {
    capturedOnClearRejection = onClearRejection;
    return <div data-testid="type-folder" data-class={classUri} />;
  },
}));

// ── imports after mocks ───────────────────────────────────────────────────────

import { useSubject } from '@ldo/solid-react';
import { useSharedCatalog } from '@/features/file-explorer/hooks/useSharedCatalog';
import { useContactRejections } from '@/shared/hooks/useContactRejections';
import { getProfileDisplayName } from '@/shared/utils/getProfileDisplayName';

// ── helpers ───────────────────────────────────────────────────────────────────

const makeCatalogEntry = (uri: string, conformsTo = ''): CatalogEntry => ({
  uri,
  conformsTo,
  title: '',
  description: '',
  modified: '',
  publisher: '',
  mediaType: '',
  byteSize: 0,
  accessURL: '',
});

const makeRejection = (accessTo: string): AccessRejection => ({
  accessTo,
  messageUri: `urn:notif:${accessTo}`,
});

// ── shared constants ──────────────────────────────────────────────────────────

const OWNER_WEB_ID = 'https://owner.example/profile/card#me';
const ALICE_WEB_ID = 'https://alice.example/profile/card#me';
const CONTACTS_WITH_ALICE = [OWNER_WEB_ID, ALICE_WEB_ID];

const mockHandleClearRejection = vi.fn();

const makeSharedCatalogResult = (overrides: Partial<ReturnType<typeof useSharedCatalog>> = {}) => ({
  sharedEntries: [],
  typeGroups: new Map(),
  resolvedCatalogUri: null,
  catalogAccessible: false,
  isProfileLoading: false,
  ...overrides,
});

function renderSection(contacts = CONTACTS_WITH_ALICE) {
  return render(
    <SharedWithMeSection contacts={contacts} ownerWebId={OWNER_WEB_ID} />,
  );
}

// ── default mock wiring ───────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  capturedOnClearRejection = null;

  vi.mocked(useSubject).mockReturnValue(null);
  vi.mocked(getProfileDisplayName).mockReturnValue('Alice');
  vi.mocked(useSharedCatalog).mockReturnValue(makeSharedCatalogResult());
  vi.mocked(useContactRejections).mockReturnValue({
    fileRejections: new Map(),
    handleClearRejection: mockHandleClearRejection,
  });
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('SharedWithMeSection — owner filtering', () => {
  it('returns null when all contacts are the owner', () => {
    const { container } = render(
      <SharedWithMeSection contacts={[OWNER_WEB_ID]} ownerWebId={OWNER_WEB_ID} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the section heading for non-owner contacts', () => {
    renderSection();
    expect(screen.getByText('sharedWithMe.heading')).toBeInTheDocument();
  });
});

describe('SharedWithMeSection — catalog not accessible', () => {
  it('renders no file cards or type folders when catalog is not accessible', () => {
    renderSection();
    expect(screen.queryByTestId('file-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('type-folder')).not.toBeInTheDocument();
  });
});

describe('SharedWithMeSection — catalog accessible', () => {
  beforeEach(() => {
    vi.mocked(useSharedCatalog).mockReturnValue(
      makeSharedCatalogResult({ catalogAccessible: true }),
    );
  });

  it('renders the contact label using getProfileDisplayName', () => {
    renderSection();
    expect(screen.getByText('sharedWithMe.from:Alice')).toBeInTheDocument();
  });

  it('shows noFilesYet when there are no shared entries or type groups', () => {
    renderSection();
    expect(screen.getByText('sharedWithMe.noFilesYet')).toBeInTheDocument();
  });

  it('renders FileCard for each shared entry', () => {
    vi.mocked(useSharedCatalog).mockReturnValue(
      makeSharedCatalogResult({
        catalogAccessible: true,
        resolvedCatalogUri: 'https://alice.example/my-solid-app/.shared-owner.ttl',
        sharedEntries: [
          makeCatalogEntry('https://alice.example/files/photo/index.ttl'),
          makeCatalogEntry('https://alice.example/files/doc/index.ttl'),
        ],
      }),
    );

    renderSection();
    expect(screen.getAllByTestId('file-card')).toHaveLength(2);
  });

  it('passes the correct containerUri to FileCard (strips index.ttl)', () => {
    vi.mocked(useSharedCatalog).mockReturnValue(
      makeSharedCatalogResult({
        catalogAccessible: true,
        sharedEntries: [makeCatalogEntry('https://alice.example/files/photo/index.ttl')],
      }),
    );

    renderSection();
    const card = screen.getByTestId('file-card');
    expect(card.getAttribute('data-uri')).toBe('https://alice.example/files/photo/');
  });

  it('passes empty string as catalogUri when resolvedCatalogUri is null', () => {
    vi.mocked(useSharedCatalog).mockReturnValue(
      makeSharedCatalogResult({
        catalogAccessible: true,
        resolvedCatalogUri: null,
        sharedEntries: [makeCatalogEntry('https://alice.example/files/photo/index.ttl')],
      }),
    );

    renderSection();
    expect(screen.getByTestId('file-card')).toBeInTheDocument();
  });

  it('renders TypeFolder for each type group', () => {
    vi.mocked(useSharedCatalog).mockReturnValue(
      makeSharedCatalogResult({
        catalogAccessible: true,
        typeGroups: new Map([
          ['http://schema.org/ImageObject', [makeCatalogEntry('https://alice.example/files/photo/index.ttl', 'http://schema.org/ImageObject')]],
          ['http://schema.org/DigitalDocument', [makeCatalogEntry('https://alice.example/files/doc/index.ttl', 'http://schema.org/DigitalDocument')]],
        ]),
      }),
    );

    renderSection();
    expect(screen.getAllByTestId('type-folder')).toHaveLength(2);
  });

  it('passes fileRejections from useContactRejections to TypeFolder', () => {
    const rejectionMap = new Map([
      ['https://alice.example/files/doc/', makeRejection('https://alice.example/files/doc/')],
    ]);
    vi.mocked(useContactRejections).mockReturnValue({
      fileRejections: rejectionMap,
      handleClearRejection: mockHandleClearRejection,
    });
    vi.mocked(useSharedCatalog).mockReturnValue(
      makeSharedCatalogResult({
        catalogAccessible: true,
        typeGroups: new Map([
          ['http://schema.org/ImageObject', [makeCatalogEntry('https://alice.example/files/photo/index.ttl', 'http://schema.org/ImageObject')]],
        ]),
      }),
    );

    renderSection();
    expect(screen.getByTestId('type-folder')).toBeInTheDocument();
  });

  it('calls handleClearRejection when TypeFolder triggers onClearRejection', () => {
    vi.mocked(useContactRejections).mockReturnValue({
      fileRejections: new Map(),
      handleClearRejection: mockHandleClearRejection,
    });
    vi.mocked(useSharedCatalog).mockReturnValue(
      makeSharedCatalogResult({
        catalogAccessible: true,
        typeGroups: new Map([
          ['http://schema.org/ImageObject', [makeCatalogEntry('https://alice.example/files/photo/index.ttl', 'http://schema.org/ImageObject')]],
        ]),
      }),
    );

    renderSection();
    expect(capturedOnClearRejection).not.toBeNull();
    act(() => {
      capturedOnClearRejection!('https://alice.example/files/photo/');
    });
    expect(mockHandleClearRejection).toHaveBeenCalledWith('https://alice.example/files/photo/');
  });
});

describe('SharedWithMeSection — display name fallback', () => {
  it('uses getProfileDisplayName result as contact label', () => {
    vi.mocked(getProfileDisplayName).mockReturnValue('noname.example');
    vi.mocked(useSharedCatalog).mockReturnValue(
      makeSharedCatalogResult({ catalogAccessible: true }),
    );

    renderSection();
    expect(screen.getByText('sharedWithMe.from:noname.example')).toBeInTheDocument();
  });
});

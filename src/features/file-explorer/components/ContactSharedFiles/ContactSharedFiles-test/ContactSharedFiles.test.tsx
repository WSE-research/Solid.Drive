import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ContactSharedFiles } from '../ContactSharedFiles-file/ContactSharedFiles';
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

const OWNER_WEB_ID = 'https://owner.example/profile/card#me';
const ALICE_WEB_ID = 'https://alice.example/profile/card#me';

const mockHandleClearRejection = vi.fn();

const makeSharedCatalogResult = (
  overrides: Partial<ReturnType<typeof useSharedCatalog>> = {},
): ReturnType<typeof useSharedCatalog> => ({
  sharedEntries: [],
  grantedEntries: [],
  typeGroups: new Map(),
  resolvedCatalogUri: null,
  catalogAccessible: false,
  isProfileLoading: false,
  ...overrides,
});

const renderRow = (props: Partial<Parameters<typeof ContactSharedFiles>[0]> = {}) =>
  render(
    <ContactSharedFiles
      contactWebId={ALICE_WEB_ID}
      viewerWebId={OWNER_WEB_ID}
      {...props}
    />,
  );

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

describe('ContactSharedFiles — catalog not accessible', () => {
  it('renders nothing when catalogAccessible is false', () => {
    const { container } = renderRow();
    expect(container.innerHTML).toBe('');
  });
});

describe('ContactSharedFiles — catalog accessible', () => {
  beforeEach(() => {
    vi.mocked(useSharedCatalog).mockReturnValue(
      makeSharedCatalogResult({ catalogAccessible: true }),
    );
  });

  it('renders the contact label using getProfileDisplayName', () => {
    renderRow();
    expect(screen.getByText('sharedWithMe.from:Alice')).toBeInTheDocument();
  });

  it('hides the from-heading when hideFromHeading is true', () => {
    renderRow({ hideFromHeading: true });
    expect(screen.queryByText(/sharedWithMe\.from/)).not.toBeInTheDocument();
  });

  it('shows noFilesYet when there are no shared entries or type groups', () => {
    renderRow();
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

    renderRow();
    expect(screen.getAllByTestId('file-card')).toHaveLength(2);
  });

  it('passes the correct containerUri to FileCard (strips index.ttl)', () => {
    vi.mocked(useSharedCatalog).mockReturnValue(
      makeSharedCatalogResult({
        catalogAccessible: true,
        sharedEntries: [makeCatalogEntry('https://alice.example/files/photo/index.ttl')],
      }),
    );

    renderRow();
    expect(screen.getByTestId('file-card').getAttribute('data-uri')).toBe(
      'https://alice.example/files/photo/',
    );
  });

  it('passes empty string as catalogUri when resolvedCatalogUri is null', () => {
    vi.mocked(useSharedCatalog).mockReturnValue(
      makeSharedCatalogResult({
        catalogAccessible: true,
        resolvedCatalogUri: null,
        sharedEntries: [makeCatalogEntry('https://alice.example/files/photo/index.ttl')],
      }),
    );

    renderRow();
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

    renderRow();
    expect(screen.getAllByTestId('type-folder')).toHaveLength(2);
  });

  it('passes fileRejections from useContactRejections to TypeFolder', () => {
    vi.mocked(useContactRejections).mockReturnValue({
      fileRejections: new Map([
        ['https://alice.example/files/doc/', makeRejection('https://alice.example/files/doc/')],
      ]),
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

    renderRow();
    expect(screen.getByTestId('type-folder')).toBeInTheDocument();
  });

  it('calls handleClearRejection when TypeFolder triggers onClearRejection', () => {
    vi.mocked(useSharedCatalog).mockReturnValue(
      makeSharedCatalogResult({
        catalogAccessible: true,
        typeGroups: new Map([
          ['http://schema.org/ImageObject', [makeCatalogEntry('https://alice.example/files/photo/index.ttl', 'http://schema.org/ImageObject')]],
        ]),
      }),
    );

    renderRow();
    expect(capturedOnClearRejection).not.toBeNull();
    act(() => {
      capturedOnClearRejection!('https://alice.example/files/photo/');
    });
    expect(mockHandleClearRejection).toHaveBeenCalledWith('https://alice.example/files/photo/');
  });
});

describe('ContactSharedFiles — entry filter', () => {
  it('drops shared entries that fail the predicate', () => {
    vi.mocked(useSharedCatalog).mockReturnValue(
      makeSharedCatalogResult({
        catalogAccessible: true,
        sharedEntries: [
          makeCatalogEntry('https://alice.example/files/photo/index.ttl', 'http://schema.org/ImageObject'),
          makeCatalogEntry('https://alice.example/files/doc/index.ttl', 'http://schema.org/DigitalDocument'),
        ],
      }),
    );

    renderRow({
      entryFilter: (entry) => entry.conformsTo === 'http://schema.org/ImageObject',
    });

    expect(screen.getAllByTestId('file-card')).toHaveLength(1);
  });

  it('drops type groups whose classUri fails the predicate', () => {
    vi.mocked(useSharedCatalog).mockReturnValue(
      makeSharedCatalogResult({
        catalogAccessible: true,
        typeGroups: new Map([
          ['http://schema.org/ImageObject', []],
          ['http://schema.org/DigitalDocument', []],
        ]),
      }),
    );

    renderRow({
      entryFilter: (entry) => entry.conformsTo === 'http://schema.org/DigitalDocument',
    });

    const folders = screen.getAllByTestId('type-folder');
    expect(folders).toHaveLength(1);
    expect(folders[0].getAttribute('data-class')).toBe('http://schema.org/DigitalDocument');
  });

  it('shows the empty hint when the predicate filters everything out', () => {
    vi.mocked(useSharedCatalog).mockReturnValue(
      makeSharedCatalogResult({
        catalogAccessible: true,
        sharedEntries: [
          makeCatalogEntry('https://alice.example/files/photo/index.ttl', 'http://schema.org/ImageObject'),
        ],
      }),
    );

    renderRow({
      entryFilter: () => false,
    });

    expect(screen.getByText('sharedWithMe.noFilesYet')).toBeInTheDocument();
    expect(screen.queryByTestId('file-card')).not.toBeInTheDocument();
  });
});

describe('ContactSharedFiles — display name fallback', () => {
  it('uses getProfileDisplayName result as contact label', () => {
    vi.mocked(getProfileDisplayName).mockReturnValue('noname.example');
    vi.mocked(useSharedCatalog).mockReturnValue(
      makeSharedCatalogResult({ catalogAccessible: true }),
    );

    renderRow();
    expect(screen.getByText('sharedWithMe.from:noname.example')).toBeInTheDocument();
  });
});

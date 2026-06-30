import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContactSharedFiles } from '../ContactSharedFiles-file/ContactSharedFiles';
import type { CatalogEntry } from '@/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string, params?: Record<string, string>) => {
    if (params?.name) return `${key}:${params.name}`;
    return key;
  }],
}));

vi.mock('@ldo/solid-react', () => ({ useSubject: vi.fn() }));
vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({ SolidProfileShapeType: {} }));

vi.mock('@/infrastructure/solid/sharedCatalog', () => ({
  toContainerUri: (uri: string) =>
    uri.endsWith('/') ? uri : uri.slice(0, uri.lastIndexOf('/') + 1),
}));

vi.mock('@/features/file-explorer/hooks/useSharedCatalog', () => ({
  useSharedCatalog: vi.fn(),
}));

vi.mock('@/shared/utils/getProfileDisplayName', () => ({
  getProfileDisplayName: vi.fn(),
}));

type RecordedFileCardProps = { containerUri: string; catalogUri: string; readOnly: boolean };
const mockFileCardProps: RecordedFileCardProps[] = [];

vi.mock('@/features/file-explorer/components/FileCard', () => ({
  FileCard: (props: RecordedFileCardProps) => {
    mockFileCardProps.push(props);
    return <div data-testid="file-card" data-uri={props.containerUri} />;
  },
}));

type RecordedBrowserProps = { contactWebId: string; viewerWebId: string; entryFilter?: unknown };
let mockBrowserProps: RecordedBrowserProps | null = null;

vi.mock('@/features/file-explorer/components/ContactCatalogBrowser', () => ({
  ContactCatalogBrowser: (props: RecordedBrowserProps) => {
    mockBrowserProps = props;
    return <div data-testid="catalog-browser" data-contact={props.contactWebId} />;
  },
}));

import { useSubject } from '@ldo/solid-react';
import { useSharedCatalog } from '@/features/file-explorer/hooks/useSharedCatalog';
import { getProfileDisplayName } from '@/shared/utils/getProfileDisplayName';

const OWNER_WEB_ID = 'https://owner.example/profile/card#me';
const ALICE_WEB_ID = 'https://alice.example/profile/card#me';
const IMAGE = 'http://schema.org/ImageObject';
const DOC = 'http://schema.org/DigitalDocument';

const makeCatalogEntry = (uri: string, conformsTo = ''): CatalogEntry => ({
  uri, conformsTo, title: '', description: '', modified: '', publisher: '', mediaType: '', byteSize: 0, accessURL: '',
});

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
  render(<ContactSharedFiles contactWebId={ALICE_WEB_ID} viewerWebId={OWNER_WEB_ID} {...props} />);

beforeEach(() => {
  vi.clearAllMocks();
  mockFileCardProps.length = 0;
  mockBrowserProps = null;
  vi.mocked(useSubject).mockReturnValue(undefined);
  vi.mocked(getProfileDisplayName).mockReturnValue('Alice');
  vi.mocked(useSharedCatalog).mockReturnValue(makeSharedCatalogResult());
});

describe('ContactSharedFiles', () => {
  it('renders nothing when the catalog is not accessible', () => {
    const { container } = renderRow();
    expect(container.innerHTML).toBe('');
  });

  describe('catalog accessible', () => {
    beforeEach(() => {
      vi.mocked(useSharedCatalog).mockReturnValue(makeSharedCatalogResult({ catalogAccessible: true }));
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

    it('hides noFilesYet when only browsable type groups exist', () => {
      vi.mocked(useSharedCatalog).mockReturnValue(makeSharedCatalogResult({
        catalogAccessible: true,
        typeGroups: new Map([[DOC, [makeCatalogEntry('https://alice.example/files/doc/index.ttl', DOC)]]]),
      }));
      renderRow();
      expect(screen.queryByText('sharedWithMe.noFilesYet')).not.toBeInTheDocument();
    });

    it('renders a read-only FileCard per shared entry, with stripped container URI and resolved catalog', () => {
      vi.mocked(useSharedCatalog).mockReturnValue(makeSharedCatalogResult({
        catalogAccessible: true,
        resolvedCatalogUri: 'https://alice.example/catalog/index.ttl',
        sharedEntries: [
          makeCatalogEntry('https://alice.example/files/photo/index.ttl'),
          makeCatalogEntry('https://alice.example/files/doc/index.ttl'),
        ],
      }));
      renderRow();
      const cards = screen.getAllByTestId('file-card');
      expect(cards).toHaveLength(2);
      expect(cards[0].getAttribute('data-uri')).toBe('https://alice.example/files/photo/');
      expect(mockFileCardProps[0]).toMatchObject({
        containerUri: 'https://alice.example/files/photo/',
        catalogUri: 'https://alice.example/catalog/index.ttl',
        readOnly: true,
      });
    });

    it('falls back to an empty catalogUri when the catalog URI is unresolved', () => {
      vi.mocked(useSharedCatalog).mockReturnValue(makeSharedCatalogResult({
        catalogAccessible: true,
        resolvedCatalogUri: null,
        sharedEntries: [makeCatalogEntry('https://alice.example/files/photo/index.ttl')],
      }));
      renderRow();
      expect(mockFileCardProps[0].catalogUri).toBe('');
    });

    it('delegates the browse section to ContactCatalogBrowser with the same contact, viewer, and filter', () => {
      const entryFilter = () => true;
      renderRow({ entryFilter });
      expect(screen.getByTestId('catalog-browser')).toBeInTheDocument();
      expect(mockBrowserProps?.contactWebId).toBe(ALICE_WEB_ID);
      expect(mockBrowserProps?.viewerWebId).toBe(OWNER_WEB_ID);
      expect(mockBrowserProps?.entryFilter).toBe(entryFilter);
    });

    it('drops shared entries that fail the predicate', () => {
      vi.mocked(useSharedCatalog).mockReturnValue(makeSharedCatalogResult({
        catalogAccessible: true,
        sharedEntries: [
          makeCatalogEntry('https://alice.example/files/photo/index.ttl', IMAGE),
          makeCatalogEntry('https://alice.example/files/doc/index.ttl', DOC),
        ],
      }));
      renderRow({ entryFilter: (entry) => entry.conformsTo === IMAGE });
      expect(screen.getAllByTestId('file-card')).toHaveLength(1);
    });
  });
});

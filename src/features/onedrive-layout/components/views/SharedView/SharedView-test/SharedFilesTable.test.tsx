import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { CatalogEntry } from '@/types';
import type { SharedFilters as SharedFiltersState } from '@/features/onedrive-layout/hooks/useSharedFilters';
import type { FilterChipDef } from '@/features/onedrive-layout/components/filters/TypeFilterChips/TypeFilterChips-file/chipCatalog';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(_key: string, fallback?: string) => fallback ?? _key],
}));

vi.mock('@ldo/solid-react', () => ({
  useSubject: vi.fn(() => null),
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({ SolidProfileShapeType: {} }));

const mockSharedCatalog = vi.fn<
  (contactWebId: string, viewerWebId: string) => {
    sharedEntries: CatalogEntry[];
    typeGroups: Map<string, CatalogEntry[]>;
    resolvedCatalogUri: string | null;
    catalogAccessible: boolean;
    isProfileLoading: boolean;
  }
>();
vi.mock('@/features/file-explorer/hooks/useSharedCatalog', () => ({
  useSharedCatalog: (contact: string, viewer: string) => mockSharedCatalog(contact, viewer),
}));

vi.mock('@/shared/hooks/useContactProfile', () => ({
  useContactProfile: () => ({ displayName: 'Alice' }),
}));

vi.mock('@/shared/utils/getProfileDisplayName', () => ({
  getProfileDisplayName: (_profile: unknown, webId: string) =>
    webId === 'https://alice.example/profile/card#me' ? 'Alice' : 'Bob',
}));

vi.mock('@/features/onedrive-layout/icons', () => {
  const Stub = () => <span />;
  return {
    WordChipIcon: Stub,
    ExcelChipIcon: Stub,
    PowerPointChipIcon: Stub,
    PdfChipIcon: Stub,
    FolderChipIcon: Stub,
    ImageChipIcon: Stub,
    VideoChipIcon: Stub,
    AudioChipIcon: Stub,
    GenericFileChipIcon: Stub,
  };
});

vi.mock('@/infrastructure/validation/fileTypeRegistry', () => ({
  getFileTypeInfo: (uri: string) => {
    const tail = uri.split('/').pop() ?? uri;
    return { label: tail, description: '' };
  },
}));

import { SharedFilesTable } from '../SharedView-file/SharedFilesTable';

const makeEntry = (overrides: Partial<CatalogEntry> = {}): CatalogEntry => ({
  uri: 'https://alice.example/files/notes/index.ttl',
  conformsTo: 'http://schema.org/PresentationDigitalDocument',
  title: 'Game design',
  description: '',
  modified: '2026-04-01T00:00:00Z',
  publisher: 'https://alice.example/profile/card#me',
  mediaType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  byteSize: 0,
  accessURL: '',
  ...overrides,
});

const passingFilters = (overrides: Partial<SharedFiltersState> = {}): SharedFiltersState => ({
  selectedClasses: new Set(),
  toggleClass: vi.fn(),
  resetClasses: vi.fn(),
  personQuery: '',
  setPersonQuery: vi.fn(),
  isActive: false,
  matchesEntry: () => true,
  matchesContact: () => true,
  ...overrides,
});

const NO_CHIPS: readonly FilterChipDef[] = [];

beforeEach(() => {
  mockSharedCatalog.mockReset();
});

describe('SharedFilesTable — empty states', () => {
  it('shows the empty hint when there are no contacts', () => {
    render(
      <SharedFilesTable
        contacts={[]}
        viewerWebId="https://owner.example/profile/card#me"
        filters={passingFilters()}
        chips={NO_CHIPS}
        onObserve={vi.fn()}
      />,
    );
    expect(screen.getByText('No contacts yet.')).toBeInTheDocument();
  });
});

describe('SharedFilesTable — column headers', () => {
  it('renders Name / Date Shared / Shared by columns', () => {
    mockSharedCatalog.mockReturnValue({
      sharedEntries: [],
      typeGroups: new Map(),
      resolvedCatalogUri: null,
      catalogAccessible: false,
      isProfileLoading: false,
    });
    render(
      <SharedFilesTable
        contacts={['https://alice.example/profile/card#me']}
        viewerWebId="https://owner.example/profile/card#me"
        filters={passingFilters()}
        chips={NO_CHIPS}
        onObserve={vi.fn()}
      />,
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Date Shared')).toBeInTheDocument();
    expect(screen.getByText('Shared by')).toBeInTheDocument();
  });
});

describe('SharedFilesTable — row rendering', () => {
  beforeEach(() => {
    mockSharedCatalog.mockReturnValue({
      sharedEntries: [makeEntry()],
      typeGroups: new Map(),
      resolvedCatalogUri: null,
      catalogAccessible: true,
      isProfileLoading: false,
    });
  });

  it('renders one row per shared entry (title + sharer)', () => {
    render(
      <SharedFilesTable
        contacts={['https://alice.example/profile/card#me']}
        viewerWebId="https://owner.example/profile/card#me"
        filters={passingFilters()}
        chips={NO_CHIPS}
        onObserve={vi.fn()}
      />,
    );
    expect(screen.getByText('Game design')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('skips contacts whose catalog is not accessible', () => {
    mockSharedCatalog.mockReturnValue({
      sharedEntries: [],
      typeGroups: new Map(),
      resolvedCatalogUri: null,
      catalogAccessible: false,
      isProfileLoading: false,
    });
    render(
      <SharedFilesTable
        contacts={['https://alice.example/profile/card#me']}
        viewerWebId="https://owner.example/profile/card#me"
        filters={passingFilters()}
        chips={NO_CHIPS}
        onObserve={vi.fn()}
      />,
    );
    expect(screen.queryByText('Game design')).not.toBeInTheDocument();
  });

  it('skips entries that fail the entry filter', () => {
    render(
      <SharedFilesTable
        contacts={['https://alice.example/profile/card#me']}
        viewerWebId="https://owner.example/profile/card#me"
        filters={passingFilters({ matchesEntry: () => false })}
        chips={NO_CHIPS}
        onObserve={vi.fn()}
      />,
    );
    expect(screen.queryByText('Game design')).not.toBeInTheDocument();
  });

  it('skips contacts that fail the person filter', () => {
    render(
      <SharedFilesTable
        contacts={['https://alice.example/profile/card#me']}
        viewerWebId="https://owner.example/profile/card#me"
        filters={passingFilters({ matchesContact: () => false })}
        chips={NO_CHIPS}
        onObserve={vi.fn()}
      />,
    );
    expect(screen.queryByText('Game design')).not.toBeInTheDocument();
  });

  it('reports the observed schema.org classes via onObserve, keyed by direction', async () => {
    const onObserve = vi.fn();
    render(
      <SharedFilesTable
        contacts={['https://alice.example/profile/card#me']}
        viewerWebId="https://owner.example/profile/card#me"
        filters={passingFilters()}
        chips={NO_CHIPS}
        onObserve={onObserve}
      />,
    );
    await waitFor(() => {
      expect(onObserve).toHaveBeenCalled();
    });
    const [reportKey, report] = onObserve.mock.calls[0];
    expect(reportKey).toBe('with-you::https://alice.example/profile/card#me');
    expect([...report.classes]).toEqual(['http://schema.org/PresentationDigitalDocument']);
    expect(report.hasPdf).toBe(false);
  });

  it('flags hasPdf=true for entries with application/pdf media type', async () => {
    mockSharedCatalog.mockReturnValue({
      sharedEntries: [makeEntry({ uri: 'https://alice.example/files/paper.pdf', mediaType: 'application/pdf' })],
      typeGroups: new Map(),
      resolvedCatalogUri: null,
      catalogAccessible: true,
      isProfileLoading: false,
    });
    const onObserve = vi.fn();
    render(
      <SharedFilesTable
        contacts={['https://alice.example/profile/card#me']}
        viewerWebId="https://owner.example/profile/card#me"
        filters={passingFilters()}
        chips={NO_CHIPS}
        onObserve={onObserve}
      />,
    );
    await waitFor(() => {
      expect(onObserve).toHaveBeenCalled();
    });
    const [, report] = onObserve.mock.calls.at(-1) as [string, { hasPdf: boolean }];
    expect(report.hasPdf).toBe(true);
  });
});

describe('SharedFilesTable — empty date cell', () => {
  it('shows an empty date cell when entry.modified is undefined', async () => {
    mockSharedCatalog.mockReturnValue({
      sharedEntries: [makeEntry({ modified: undefined })],
      typeGroups: new Map(),
      resolvedCatalogUri: null,
      catalogAccessible: true,
      isProfileLoading: false,
    });
    const { container } = render(
      <SharedFilesTable
        contacts={['https://alice.example/profile/card#me']}
        viewerWebId="https://owner.example/profile/card#me"
        filters={passingFilters()}
        chips={NO_CHIPS}
        onObserve={vi.fn()}
      />,
    );
    const dateCell = container.querySelector('.odl-shared-row__date');
    expect(dateCell?.textContent).toBe('');
  });

  it('shows an empty date cell when entry.modified is an invalid date', async () => {
    mockSharedCatalog.mockReturnValue({
      sharedEntries: [makeEntry({ modified: 'not-a-date' })],
      typeGroups: new Map(),
      resolvedCatalogUri: null,
      catalogAccessible: true,
      isProfileLoading: false,
    });
    const { container } = render(
      <SharedFilesTable
        contacts={['https://alice.example/profile/card#me']}
        viewerWebId="https://owner.example/profile/card#me"
        filters={passingFilters()}
        chips={NO_CHIPS}
        onObserve={vi.fn()}
      />,
    );
    const dateCell = container.querySelector('.odl-shared-row__date');
    expect(dateCell?.textContent).toBe('');
  });
});

describe('SharedFilesTable — pickEntryVisual branches', () => {
  it('uses the PDF icon for entries with application/pdf mediaType', () => {
    mockSharedCatalog.mockReturnValue({
      sharedEntries: [
        makeEntry({
          uri: 'https://alice.example/files/paper.pdf',
          title: '',
          mediaType: 'application/pdf',
          conformsTo: undefined,
        }),
      ],
      typeGroups: new Map(),
      resolvedCatalogUri: null,
      catalogAccessible: true,
      isProfileLoading: false,
    });
    render(
      <SharedFilesTable
        contacts={['https://alice.example/profile/card#me']}
        viewerWebId="https://owner.example/profile/card#me"
        filters={passingFilters()}
        chips={NO_CHIPS}
        onObserve={vi.fn()}
      />,
    );
    // title is '' so the row shows the URI tail 'paper.pdf'
    expect(screen.getByText('paper.pdf')).toBeInTheDocument();
  });

  it('uses the generic DigitalDocument fallback when conformsTo is undefined and not PDF', () => {
    mockSharedCatalog.mockReturnValue({
      sharedEntries: [
        makeEntry({
          uri: 'https://alice.example/files/unknown.bin',
          title: '',
          mediaType: 'application/octet-stream',
          conformsTo: undefined,
        }),
      ],
      typeGroups: new Map(),
      resolvedCatalogUri: null,
      catalogAccessible: true,
      isProfileLoading: false,
    });
    render(
      <SharedFilesTable
        contacts={['https://alice.example/profile/card#me']}
        viewerWebId="https://owner.example/profile/card#me"
        filters={passingFilters()}
        chips={NO_CHIPS}
        onObserve={vi.fn()}
      />,
    );
    expect(screen.getByText('unknown.bin')).toBeInTheDocument();
  });
});

describe('SharedFilesTable — by-you direction', () => {
  it('reads the catalog from the OWNER\'s pod (swapped useSharedCatalog args)', () => {
    mockSharedCatalog.mockReturnValue({
      sharedEntries: [],
      typeGroups: new Map(),
      resolvedCatalogUri: null,
      catalogAccessible: false,
      isProfileLoading: false,
    });
    render(
      <SharedFilesTable
        contacts={['https://alice.example/profile/card#me']}
        viewerWebId="https://owner.example/profile/card#me"
        direction="by-you"
        filters={passingFilters()}
        chips={NO_CHIPS}
        onObserve={vi.fn()}
      />,
    );
    expect(mockSharedCatalog).toHaveBeenCalledWith(
      'https://owner.example/profile/card#me',
      'https://alice.example/profile/card#me',
    );
  });

  it('shows the by-you empty hint when there are no contacts in by-you direction', () => {
    render(
      <SharedFilesTable
        contacts={[]}
        viewerWebId="https://owner.example/profile/card#me"
        direction="by-you"
        filters={passingFilters()}
        chips={NO_CHIPS}
        onObserve={vi.fn()}
      />,
    );
    expect(
      screen.getByText('Add contacts to share files with them.'),
    ).toBeInTheDocument();
  });

  it('renders "Shared with" instead of "Shared by" in the third column', () => {
    mockSharedCatalog.mockReturnValue({
      sharedEntries: [],
      typeGroups: new Map(),
      resolvedCatalogUri: null,
      catalogAccessible: false,
      isProfileLoading: false,
    });
    render(
      <SharedFilesTable
        contacts={['https://alice.example/profile/card#me']}
        viewerWebId="https://owner.example/profile/card#me"
        direction="by-you"
        filters={passingFilters()}
        chips={NO_CHIPS}
        onObserve={vi.fn()}
      />,
    );
    expect(screen.getByText('Shared with')).toBeInTheDocument();
    expect(screen.queryByText('Shared by')).not.toBeInTheDocument();
  });

  it('keys observations with "by-you::" so they do not collide with with-you', async () => {
    mockSharedCatalog.mockReturnValue({
      sharedEntries: [makeEntry()],
      typeGroups: new Map(),
      resolvedCatalogUri: null,
      catalogAccessible: true,
      isProfileLoading: false,
    });
    const onObserve = vi.fn();
    render(
      <SharedFilesTable
        contacts={['https://alice.example/profile/card#me']}
        viewerWebId="https://owner.example/profile/card#me"
        direction="by-you"
        filters={passingFilters()}
        chips={NO_CHIPS}
        onObserve={onObserve}
      />,
    );
    await waitFor(() => {
      expect(onObserve).toHaveBeenCalled();
    });
    const [reportKey] = onObserve.mock.calls[0];
    expect(reportKey).toBe('by-you::https://alice.example/profile/card#me');
  });
});

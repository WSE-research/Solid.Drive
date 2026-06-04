import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContactCatalogBrowser } from '../ContactCatalogBrowser-file/ContactCatalogBrowser';
import type { CatalogEntry } from '@/types';
import type { AccessApproval, AccessRejection } from '@/infrastructure/inbox/inboxAccess';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

vi.mock('@/features/file-explorer/hooks/useSharedCatalog', () => ({ useSharedCatalog: vi.fn() }));
vi.mock('@/shared/hooks/useContactRejections', () => ({ useContactRejections: vi.fn() }));

type RecordedTypeFolderProps = {
  classUri: string;
  entries: CatalogEntry[];
  contactWebId: string;
  viewerWebId: string;
  rejections: Map<string, AccessRejection>;
  approvals: Map<string, AccessApproval>;
  onClearOutcome: (accessTo: string) => void;
};

const mockTypeFolderProps: RecordedTypeFolderProps[] = [];

vi.mock('@/features/file-explorer/components/TypeFolder', () => ({
  TypeFolder: (props: RecordedTypeFolderProps) => {
    mockTypeFolderProps.push(props);
    return <div data-testid="type-folder" data-class={props.classUri} />;
  },
}));

import { useSharedCatalog } from '@/features/file-explorer/hooks/useSharedCatalog';
import { useContactRejections } from '@/shared/hooks/useContactRejections';

const ALICE = 'https://alice.example/profile/card#me';
const OWNER = 'https://owner.example/profile/card#me';
const IMAGE = 'http://schema.org/ImageObject';
const DOC = 'http://schema.org/DigitalDocument';

const makeEntry = (uri: string, conformsTo = ''): CatalogEntry => ({
  uri, conformsTo, title: '', description: '', modified: '', publisher: '', mediaType: '', byteSize: 0, accessURL: '',
});

const makeRejection = (accessTo: string): AccessRejection => ({ accessTo, messageUri: `urn:notif:reject:${accessTo}` });
const makeApproval = (accessTo: string): AccessApproval => ({ accessTo, messageUri: `urn:notif:approve:${accessTo}` });

const makeCatalog = (
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

const makeOutcomes = (
  overrides: Partial<ReturnType<typeof useContactRejections>> = {},
): ReturnType<typeof useContactRejections> => ({
  fileRejections: new Map(),
  fileApprovals: new Map(),
  handleClearRejection: vi.fn(),
  ...overrides,
});

const renderBrowser = (props: Partial<Parameters<typeof ContactCatalogBrowser>[0]> = {}) =>
  render(<ContactCatalogBrowser contactWebId={ALICE} viewerWebId={OWNER} {...props} />);

beforeEach(() => {
  vi.clearAllMocks();
  mockTypeFolderProps.length = 0;
  vi.mocked(useSharedCatalog).mockReturnValue(makeCatalog());
  vi.mocked(useContactRejections).mockReturnValue(makeOutcomes());
});

describe('ContactCatalogBrowser', () => {
  it('renders nothing when there are no browsable type groups', () => {
    const { container } = renderBrowser();
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when the entry filter rejects every group', () => {
    vi.mocked(useSharedCatalog).mockReturnValue(makeCatalog({
      typeGroups: new Map([[IMAGE, [makeEntry('https://alice.example/files/photo/index.ttl', IMAGE)]]]),
    }));
    const { container } = renderBrowser({ entryFilter: () => false });
    expect(container.innerHTML).toBe('');
  });

  it('shows the browse heading above the folders when groups are present', () => {
    vi.mocked(useSharedCatalog).mockReturnValue(makeCatalog({
      typeGroups: new Map([[DOC, [makeEntry('https://alice.example/files/doc/index.ttl', DOC)]]]),
    }));
    renderBrowser();
    expect(screen.getByText('sharedWithMe.browseHeading')).toBeInTheDocument();
    expect(screen.getByTestId('type-folder')).toBeInTheDocument();
  });

  it('renders one TypeFolder per browsable type group', () => {
    vi.mocked(useSharedCatalog).mockReturnValue(makeCatalog({
      typeGroups: new Map([
        [IMAGE, [makeEntry('https://alice.example/files/photo/index.ttl', IMAGE)]],
        [DOC, [makeEntry('https://alice.example/files/doc/index.ttl', DOC)]],
      ]),
    }));
    renderBrowser();
    expect(screen.getAllByTestId('type-folder')).toHaveLength(2);
  });

  it('omits type groups whose classUri fails the entry filter', () => {
    vi.mocked(useSharedCatalog).mockReturnValue(makeCatalog({
      typeGroups: new Map([
        [IMAGE, [makeEntry('https://alice.example/files/photo/index.ttl', IMAGE)]],
        [DOC, [makeEntry('https://alice.example/files/doc/index.ttl', DOC)]],
      ]),
    }));
    renderBrowser({ entryFilter: (entry) => entry.conformsTo === DOC });
    const folders = screen.getAllByTestId('type-folder');
    expect(folders).toHaveLength(1);
    expect(folders[0].getAttribute('data-class')).toBe(DOC);
  });

  it('forwards the contact, viewer, entries, and outcome maps to each TypeFolder', () => {
    const entry = makeEntry('https://alice.example/files/doc/index.ttl', DOC);
    const fileRejections = new Map([['https://alice.example/files/doc/', makeRejection('https://alice.example/files/doc/')]]);
    const fileApprovals = new Map([['https://alice.example/files/photo/', makeApproval('https://alice.example/files/photo/')]]);
    const handleClearRejection = vi.fn();

    vi.mocked(useContactRejections).mockReturnValue(makeOutcomes({ fileRejections, fileApprovals, handleClearRejection }));
    vi.mocked(useSharedCatalog).mockReturnValue(makeCatalog({ typeGroups: new Map([[DOC, [entry]]]) }));

    renderBrowser();

    expect(mockTypeFolderProps).toHaveLength(1);
    const props = mockTypeFolderProps[0];
    expect(props.classUri).toBe(DOC);
    expect(props.entries).toEqual([entry]);
    expect(props.contactWebId).toBe(ALICE);
    expect(props.viewerWebId).toBe(OWNER);
    expect(props.rejections).toBe(fileRejections);
    expect(props.approvals).toBe(fileApprovals);
    expect(props.onClearOutcome).toBe(handleClearRejection);
  });
});

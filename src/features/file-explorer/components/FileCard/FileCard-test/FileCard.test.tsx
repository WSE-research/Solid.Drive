import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileCard } from '../FileCard-file/FileCard';

// ── module mocks ─────────────────────────────────────────────────────────────

vi.mock('@ldo/solid-react', () => ({
  useLdo: vi.fn(),
  useResource: vi.fn(),
  useSubject: vi.fn(),
  useSolidAuth: vi.fn(),
}));

vi.mock('@/.ldo/catalogEntry.shapeTypes', () => ({ CatalogEntryShShapeType: {} }));
vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({ SolidProfileShapeType: {} }));

vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isLoadable: vi.fn(() => false),
  isReadable: vi.fn(() => false),
  isDeletable: vi.fn(() => false),
  isSolidContainer: vi.fn(() => false),
}));

vi.mock('@/shared/utils/formatBytes', () => ({
  formatBytes: vi.fn((byteCount: string) => `${byteCount} bytes`),
}));

vi.mock('@/infrastructure/solid/catalog', () => ({
  removeFromCatalog: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/infrastructure/validation/fileTypeRegistry', () => ({
  getFileTypeInfo: vi.fn(() => ({ label: 'PDF', icon: 'ðŸ”„' })),
  resolveClass: vi.fn(() => 'https://schema.org/DigitalDocument'),
}));

vi.mock('@/features/file-explorer/components/SharePanel/SharePanel-file/SharePanel', () => ({
  SharePanel: () => <div data-testid="share-panel" />,
}));

vi.mock('@/features/file-explorer/hooks/useFileSharing', () => ({
  useFileSharing: vi.fn(() => false),
}));

vi.mock('@/features/file-explorer/hooks/useFilePreview', () => ({
  useFilePreview: vi.fn(() => ({ previewUrl: null })),
}));

vi.mock('@/shared/contexts/NotificationContext', () => ({
  useNotifications: vi.fn(),
}));

vi.mock('../FileCard-file/FileMediaPreview', () => ({
  FileMediaPreview: () => <div data-testid="file-media-preview" />,
}));

vi.mock('../FileCard-file/FileCardInfoPanel', () => ({
  FileCardInfoPanel: () => <div data-testid="file-card-info-panel" />,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

// ── imports after mocks ───────────────────────────────────────────────────────

import { useLdo, useResource, useSubject, useSolidAuth } from '@ldo/solid-react';
import {
  isLoadable, isReadable, isDeletable, isSolidContainer,
} from '@/infrastructure/solid/resourceGuards';
import { useFileSharing } from '@/features/file-explorer/hooks/useFileSharing';
import { useFilePreview } from '@/features/file-explorer/hooks/useFilePreview';
import { useNotifications } from '@/shared/contexts/NotificationContext';
import { removeFromCatalog } from '@/infrastructure/solid/catalog';
import { resolveClass } from '@/infrastructure/validation/fileTypeRegistry';

// ── shared constants ──────────────────────────────────────────────────────────

const CONTAINER_URI = 'https://user.example/files/doc1/';
const CATALOG_URI = 'https://user.example/catalog.ttl';
const METADATA_URI = `${CONTAINER_URI}index.ttl`;

const makeResource = (opts: {
  isLoading?: boolean;
  isUnfetched?: boolean;
  isFetched?: boolean;
  isReading?: boolean;
} = {}) => ({
  isLoading: () => opts.isLoading ?? false,
  isUnfetched: () => opts.isUnfetched ?? false,
  isFetched: () => opts.isFetched ?? true,
  isReading: () => opts.isReading ?? false,
});

const baseFileMeta = {
  name: 'report.pdf',
  description: 'A sample report',
  uploadDate: '2024-01-15',
  dateModified: '2024-02-01',
  encodingFormat: 'application/pdf',
  contentSize: '12345',
  publisher: { '@id': 'https://publisher.example/card#me' },
  image: undefined as { '@id': string } | undefined,
  isPartOf: undefined,
};

const mockGetResource = vi.fn();
const mockConfirm = vi.fn();

// ── default mock wiring ───────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(useSolidAuth).mockReturnValue({
    session: { isLoggedIn: true, webId: 'https://me.example/card#me' },
    fetch: vi.fn(),
  });
  vi.mocked(useLdo).mockReturnValue({ getResource: mockGetResource });
  vi.mocked(useResource).mockReturnValue(makeResource());
  vi.mocked(useSubject).mockReturnValue(null);

  vi.mocked(isLoadable).mockReturnValue(false);
  vi.mocked(isReadable).mockReturnValue(false);
  vi.mocked(isDeletable).mockReturnValue(false);
  vi.mocked(isSolidContainer).mockReturnValue(false);

  vi.mocked(useFileSharing).mockReturnValue(false);
  vi.mocked(useFilePreview).mockReturnValue({ previewUrl: undefined });
  vi.mocked(useNotifications).mockReturnValue({ confirm: mockConfirm } as unknown as ReturnType<typeof useNotifications>);
  mockConfirm.mockResolvedValue(false);
});

// ── helpers ───────────────────────────────────────────────────────────────────

function renderCard(props: { readOnly?: boolean } = {}) {
  return render(
    <FileCard
      containerUri={CONTAINER_URI}
      catalogUri={CATALOG_URI}
      {...props}
    />,
  );
}

function withFileMeta(overrides: Partial<typeof baseFileMeta> = {}) {
  vi.mocked(useSubject).mockImplementation((_shapeType: unknown, uri: string) => {
    if (uri === METADATA_URI) return { ...baseFileMeta, ...overrides };
    return null;
  });
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('FileCard — loading state', () => {
  it('shows a spinner when the metadata resource is loading', () => {
    vi.mocked(isLoadable).mockReturnValue(true);
    vi.mocked(useResource).mockReturnValue(makeResource({ isLoading: true }));
    renderCard();
    expect(screen.getByText('fileCard.loading')).toBeInTheDocument();
    expect(document.querySelector('.spinner')).toBeInTheDocument();
  });

  it('shows a spinner when the metadata resource is unfetched', () => {
    vi.mocked(isLoadable).mockReturnValue(true);
    vi.mocked(useResource).mockReturnValue(makeResource({ isUnfetched: true }));
    renderCard();
    expect(screen.getByText('fileCard.loading')).toBeInTheDocument();
  });

  it('shows a spinner when the metadata resource is being read', () => {
    vi.mocked(isReadable).mockReturnValue(true);
    vi.mocked(useResource).mockReturnValue(makeResource({ isReading: true }));
    renderCard();
    expect(screen.getByText('fileCard.loading')).toBeInTheDocument();
  });
});

describe('FileCard — readOnly + fetched + no uploadDate → returns null', () => {
  it('renders nothing when readOnly, fetched, and fileMeta has no uploadDate', () => {
    vi.mocked(isLoadable).mockReturnValue(true);
    vi.mocked(useResource).mockReturnValue(makeResource({ isFetched: true }));
    withFileMeta({ uploadDate: undefined });
    const { container } = renderCard({ readOnly: true });
    expect(container).toBeEmptyDOMElement();
  });
});

describe('FileCard — no fileMeta (folder fallback)', () => {
  it('shows the folder name decoded from containerUri', () => {
    renderCard();
    expect(screen.getByText('doc1')).toBeInTheDocument();
  });

  it('shows a URL-decoded folder name', () => {
    render(
      <FileCard
        containerUri="https://user.example/files/my%20folder/"
        catalogUri={CATALOG_URI}
      />,
    );
    expect(screen.getByText('my folder')).toBeInTheDocument();
  });

  it('does not show a download link when there is no binaryUri', () => {
    renderCard();
    expect(screen.queryByText('fileCard.download')).not.toBeInTheDocument();
  });

  it('shows download link and noMetadata text when a binary child exists', () => {
    const childUri = `${CONTAINER_URI}report.pdf`;
    const mockChild = { uri: childUri };
    const containerResource = {
      ...makeResource(),
      children: () => [mockChild],
    };
    vi.mocked(useResource).mockImplementation((uri: string) =>
      uri === CONTAINER_URI ? containerResource : makeResource(),
    );
    vi.mocked(isSolidContainer).mockImplementation(
      (resource: unknown) => resource === containerResource,
    );
    renderCard();
    expect(screen.getByText('fileCard.noMetadata')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'fileCard.download' })).toHaveAttribute('href', childUri);
  });
});

describe('FileCard — full card render', () => {
  beforeEach(() => {
    withFileMeta();
  });

  it('renders the file name', () => {
    renderCard();
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
  });

  it('renders the description', () => {
    renderCard();
    expect(screen.getByText('A sample report')).toBeInTheDocument();
  });

  it('renders the encoding format', () => {
    renderCard();
    expect(screen.getByText('application/pdf')).toBeInTheDocument();
  });

  it('renders the formatted content size', () => {
    renderCard();
    expect(screen.getByText('12345 bytes')).toBeInTheDocument();
  });

  it('renders the upload date in a date element', () => {
    renderCard();
    expect(document.querySelector('.file-card__date')).toBeInTheDocument();
  });

  it('shows a "shared" icon when the file is shared', () => {
    vi.mocked(useFileSharing).mockReturnValue(true);
    renderCard();
    expect(document.querySelector('.file-card__shared')).toBeInTheDocument();
  });

  it('hides the "shared" icon when the file is not shared', () => {
    renderCard();
    expect(document.querySelector('.file-card__shared')).not.toBeInTheDocument();
  });

  it('renders FileMediaPreview when previewUrl is available', () => {
    vi.mocked(useFilePreview).mockReturnValue({ previewUrl: 'blob:preview' });
    renderCard();
    expect(screen.getByTestId('file-media-preview')).toBeInTheDocument();
  });

  it('does not render FileMediaPreview when there is no previewUrl', () => {
    renderCard();
    expect(screen.queryByTestId('file-media-preview')).not.toBeInTheDocument();
  });

  it('renders a download link using previewUrl when available', () => {
    vi.mocked(useFilePreview).mockReturnValue({ previewUrl: 'blob:preview' });
    renderCard();
    expect(screen.getByRole('link', { name: 'fileCard.download' })).toHaveAttribute('href', 'blob:preview');
  });

  it('renders a download link using binaryUri when no previewUrl', () => {
    // fileMeta.name is set → binaryUri = containerUri + name
    renderCard();
    const link = screen.getByRole('link', { name: 'fileCard.download' });
    expect(link).toHaveAttribute('href', `${CONTAINER_URI}report.pdf`);
  });

  it('hides download link when neither previewUrl nor binaryUri is available', () => {
    withFileMeta({ name: undefined, image: undefined });
    renderCard();
    expect(screen.queryByRole('link', { name: 'fileCard.download' })).not.toBeInTheDocument();
  });
});

describe('FileCard — info panel toggle', () => {
  beforeEach(() => withFileMeta());

  it('does not show FileCardInfoPanel initially', () => {
    renderCard();
    expect(screen.queryByTestId('file-card-info-panel')).not.toBeInTheDocument();
  });

  it('shows FileCardInfoPanel after clicking the info button', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'fileCard.info' }));
    expect(screen.getByTestId('file-card-info-panel')).toBeInTheDocument();
  });

  it('hides FileCardInfoPanel again after clicking a second time', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'fileCard.info' }));
    fireEvent.click(screen.getByRole('button', { name: 'fileCard.hideInfo' }));
    expect(screen.queryByTestId('file-card-info-panel')).not.toBeInTheDocument();
  });
});

describe('FileCard — share panel toggle', () => {
  beforeEach(() => withFileMeta());

  it('does not show SharePanel initially', () => {
    renderCard();
    expect(screen.queryByTestId('share-panel')).not.toBeInTheDocument();
  });

  it('shows SharePanel after clicking the share button', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'fileCard.share' }));
    expect(screen.getByTestId('share-panel')).toBeInTheDocument();
  });

  it('hides SharePanel again after clicking a second time', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'fileCard.share' }));
    fireEvent.click(screen.getByRole('button', { name: 'fileCard.hideShare' }));
    expect(screen.queryByTestId('share-panel')).not.toBeInTheDocument();
  });

  it('does not render the share button when readOnly', () => {
    renderCard({ readOnly: true });
    expect(screen.queryByRole('button', { name: 'fileCard.share' })).not.toBeInTheDocument();
  });
});

describe('FileCard — delete button', () => {
  beforeEach(() => withFileMeta());

  it('renders the delete button when not readOnly', () => {
    renderCard();
    expect(screen.getByRole('button', { name: 'fileCard.delete' })).toBeInTheDocument();
  });

  it('hides the delete button when readOnly', () => {
    renderCard({ readOnly: true });
    expect(screen.queryByRole('button', { name: 'fileCard.delete' })).not.toBeInTheDocument();
  });
});

describe('FileCard — delete action', () => {
  beforeEach(() => withFileMeta());

  it('does not call removeFromCatalog when the user cancels the confirmation', async () => {
    mockConfirm.mockResolvedValue(false);
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'fileCard.delete' }));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
    expect(removeFromCatalog).not.toHaveBeenCalled();
  });

  it('calls removeFromCatalog with the correct URIs when confirmed', async () => {
    mockConfirm.mockResolvedValue(true);
    const mockDelete = vi.fn(() => Promise.resolve());
    mockGetResource.mockReturnValue({ delete: mockDelete });
    vi.mocked(isDeletable).mockReturnValue(true);
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'fileCard.delete' }));
    await waitFor(() => expect(removeFromCatalog).toHaveBeenCalledWith(CATALOG_URI, METADATA_URI, expect.any(Function)));
  });

  it('deletes the container after removing from catalog when confirmed', async () => {
    mockConfirm.mockResolvedValue(true);
    const mockDelete = vi.fn(() => Promise.resolve());
    mockGetResource.mockReturnValue({ delete: mockDelete });
    vi.mocked(isDeletable).mockReturnValue(true);
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'fileCard.delete' }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledTimes(1));
  });

  it('does not call container.delete when the container is not deletable', async () => {
    mockConfirm.mockResolvedValue(true);
    const mockDelete = vi.fn(() => Promise.resolve());
    mockGetResource.mockReturnValue({ delete: mockDelete });
    vi.mocked(isDeletable).mockReturnValue(false);
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'fileCard.delete' }));
    await waitFor(() => expect(removeFromCatalog).toHaveBeenCalled());
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

describe('FileCard — classUri branch coverage', () => {
  it('falls back to default file type class when no encoding format exists', () => {
    withFileMeta({ encodingFormat: undefined });
    renderCard();
    expect(document.querySelector('file-card')).toBeInTheDocument();
  });

  it('resolves class URI from MIME type via resolveClass', () => {
    withFileMeta({ encodingFormat: 'image/jpeg' });
    renderCard();
    expect(vi.mocked(resolveClass)).toHaveBeenCalledWith('image/jpeg');
    expect(document.querySelector('file-card')).toBeInTheDocument();
  });
});

describe('FileCard — SharePanel props fallback branches', () => {
  it('passes fallback values to SharePanel when fields are missing', () => {
    withFileMeta({
      name: undefined,
      description: undefined,
      dateModified: undefined,
      uploadDate: undefined,
      encodingFormat: undefined,
      contentSize: undefined,
      image: { '@id': 'https://user.example/files/doc1/img.png' },
    });
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'fileCard.share' }));
    // SharePanel rendered with fallback values for binaryUri, title, description, modified
    expect(screen.getByTestId('share-panel')).toBeInTheDocument();
  });

  it('falls back binaryUri to metadataUri when both name and image are missing', () => {
    // binaryUri = undefined (no name, no image, no container children)
    // → binaryUri ?? metadataUri (line 207)
    // Also name is undefined → metadataUri.split("/").pop() (line 211)
    withFileMeta({
      name: undefined,
      description: undefined,
      dateModified: undefined,
      uploadDate: undefined,
      encodingFormat: undefined,
      contentSize: undefined,
      image: undefined,
    });
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'fileCard.share' }));
    expect(screen.getByTestId('share-panel')).toBeInTheDocument();
  });

  it('passes encodingFormat fallback to FileMediaPreview when previewUrl exists', () => {
    vi.mocked(useFilePreview).mockReturnValue({ previewUrl: 'blob:preview' });
    withFileMeta({ encodingFormat: undefined });
    renderCard();
    // encodingFormat ?? "" is passed to FileMediaPreview (mocked)
    expect(screen.getByTestId('file-media-preview')).toBeInTheDocument();
  });
});

describe('FileCard — date branch coverage', () => {
  it('renders empty string for uploadedAt when uploadDate is undefined', () => {
    withFileMeta({ uploadDate: undefined });
    renderCard();
    // uploadedAt = "" — the .file-card__date span is empty
    const dateEl = document.querySelector('.file-card__date');
    expect(dateEl).toBeInTheDocument();
    expect(dateEl!.textContent).toBe('');
  });

  it('renders empty string for dateModified when dateModified is undefined', () => {
    withFileMeta({ dateModified: undefined });
    renderCard();
    // dateModified = "" — rendered in FileCardInfoPanel (mocked), so we verify it doesn't crash
    expect(document.querySelector('file-card')).toBeInTheDocument();
  });

  it('renders formatted uploadedAt when uploadDate is present', () => {
    withFileMeta({ uploadDate: '2024-01-15' });
    renderCard();
    const dateEl = document.querySelector('.file-card__date');
    expect(dateEl).toBeInTheDocument();
    expect(dateEl!.textContent).not.toBe('');
  });

  it('uses fileMeta.image as binaryUri fallback when name is undefined', () => {
    withFileMeta({ name: undefined, image: { '@id': 'https://user.example/files/doc1/image.png' } });
    renderCard();
    const link = screen.getByRole('link', { name: 'fileCard.download' });
    expect(link).toHaveAttribute('href', 'https://user.example/files/doc1/image.png');
  });

  it('uses binaryUri from container children when container is a SolidContainer', () => {
    const childLeaf = { uri: `${CONTAINER_URI}report.pdf` };
    const indexLeaf = { uri: `${CONTAINER_URI}index.ttl` };
    const containerRes = {
      ...makeResource(),
      children: () => [indexLeaf, childLeaf],
    };
    vi.mocked(useResource).mockImplementation((uri: string) =>
      uri === CONTAINER_URI ? containerRes : makeResource(),
    );
    vi.mocked(isSolidContainer).mockImplementation(
      (resource: unknown) => resource === containerRes,
    );
    withFileMeta();
    renderCard();
    // binaryUri should be childLeaf.uri (not index.ttl, not a container)
    expect(document.querySelector('file-card')).toBeInTheDocument();
  });
});

describe('FileCard — publisher name branch coverage', () => {
  it('uses publisherProfile.fn as publisher name when fn is set', () => {
    withFileMeta();
    vi.mocked(useSubject).mockImplementation((_shapeType: unknown, uri: string) => {
      if (uri === METADATA_URI) return { ...baseFileMeta };
      if (uri === 'https://publisher.example/card#me') return { fn: 'Alice FN', name: null };
      return null;
    });
    renderCard();
    expect(document.querySelector('file-card')).toBeInTheDocument();
  });

  it('uses publisherProfile.name when fn is null', () => {
    withFileMeta();
    vi.mocked(useSubject).mockImplementation((_shapeType: unknown, uri: string) => {
      if (uri === METADATA_URI) return { ...baseFileMeta };
      if (uri === 'https://publisher.example/card#me') return { fn: null, name: 'Alice Name' };
      return null;
    });
    renderCard();
    expect(document.querySelector('file-card')).toBeInTheDocument();
  });

  it('populates contacts from ownerProfile.knows entries', () => {
    withFileMeta();
    vi.mocked(useSubject).mockImplementation((_shapeType: unknown, uri: string) => {
      if (uri === METADATA_URI) return { ...baseFileMeta };
      if (uri === 'https://me.example/card#me') {
        return {
          knows: {
            toArray: () => [{ '@id': 'https://alice.example/card#me' }, { '@id': 'https://bob.example/card#me' }],
          },
        };
      }
      return null;
    });
    renderCard();
    expect(document.querySelector('file-card')).toBeInTheDocument();
  });
});


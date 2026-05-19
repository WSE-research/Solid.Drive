import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DetailPanel } from '../DetailPanel-file/DetailPanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, fallback?: string) => fallback ?? key,
  ],
}));

vi.mock('../EditableDescription', () => ({
  EditableDescription: ({ initial }: { initial: string | undefined }) => (
    <div data-testid="mock-editable-description" data-initial={initial ?? ''} />
  ),
}));

vi.mock('../HasAccessRow', () => ({
  HasAccessRow: ({ uri }: { uri: string }) => (
    <div data-testid="mock-has-access-row" data-uri={uri} />
  ),
}));

let mockPreviewUrl: string | undefined;
let mockPreviewCalls: Array<string | undefined> = [];
vi.mock('@/features/file-explorer', () => ({
  useFilePreview: (uri: string | undefined) => {
    mockPreviewCalls.push(uri);
    return { previewUrl: mockPreviewUrl };
  },
}));

let mockResource: unknown = null;
vi.mock('@ldo/solid-react', () => ({
  useResource: () => mockResource,
}));

let mockIsContainer: (entry: unknown) => boolean = () => false;
vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isSolidContainer: (entry: unknown) => mockIsContainer(entry),
}));

const fileSelected = {
  kind: 'file' as const,
  uri: 'https://pod/app/report/',
  name: 'report.pdf',
};

const folderSelected = {
  kind: 'folder' as const,
  uri: 'https://pod/app/docs/',
  name: 'docs',
};

const fileDetails = {
  kind: 'file' as const,
  uri: 'https://pod/app/report/',
  name: 'report.pdf',
  metadataUri: 'https://pod/app/report/index.ttl',
  binaryUri: undefined,
  description: undefined,
  mediaType: 'application/pdf',
  conformsTo: undefined,
  byteSize: 12345,
  modified: '2026-04-01T00:00:00Z',
  created: undefined,
};

const folderDetails = {
  kind: 'folder' as const,
  uri: 'https://pod/app/docs/',
  name: 'docs',
  itemCount: 4,
  modified: undefined,
};

describe('DetailPanel', () => {
  it('is aria-hidden when closed', () => {
    const { container } = render(
      <DetailPanel
        open={false}
        selected={null}
        details={null}
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector('detail-panel')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('is visible when open is true', () => {
    const { container } = render(
      <DetailPanel
        open
        selected={null}
        details={null}
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector('detail-panel')).toHaveAttribute(
      'aria-hidden',
      'false',
    );
  });

  it('shows the empty hint when nothing is selected', () => {
    render(
      <DetailPanel open selected={null} details={null} onClose={vi.fn()} />,
    );
    expect(screen.getByText(/select an item/i)).toBeInTheDocument();
  });

  it('renders the file name when a file is selected', () => {
    render(
      <DetailPanel
        open
        selected={fileSelected}
        details={fileDetails}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'report.pdf' }),
    ).toBeInTheDocument();
  });

  it('Close button forwards onClose', () => {
    const onClose = vi.fn();
    render(
      <DetailPanel
        open
        selected={folderSelected}
        details={folderDetails}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows the More details divider when a file is selected', () => {
    render(
      <DetailPanel
        open
        selected={fileSelected}
        details={fileDetails}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/more details/i)).toBeInTheDocument();
  });

  it('renders the Type row with the mediaType for files', () => {
    render(
      <DetailPanel
        open
        selected={fileSelected}
        details={fileDetails}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('application/pdf')).toBeInTheDocument();
  });

  it('renders the Items count for folders instead of file size', () => {
    render(
      <DetailPanel
        open
        selected={folderSelected}
        details={folderDetails}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('does not render the Type row for folders', () => {
    render(
      <DetailPanel
        open
        selected={folderSelected}
        details={folderDetails}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText(/^type$/i)).not.toBeInTheDocument();
  });

  it('renders the EditableDescription only for files', () => {
    const { rerender } = render(
      <DetailPanel
        open
        selected={fileSelected}
        details={fileDetails}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('mock-editable-description')).toBeInTheDocument();
    rerender(
      <DetailPanel
        open
        selected={folderSelected}
        details={folderDetails}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.queryByTestId('mock-editable-description'),
    ).not.toBeInTheDocument();
  });

  it('renders HasAccessRow for both files and folders', () => {
    const { rerender } = render(
      <DetailPanel
        open
        selected={fileSelected}
        details={fileDetails}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('mock-has-access-row')).toHaveAttribute(
      'data-uri',
      'https://pod/app/report/',
    );
    rerender(
      <DetailPanel
        open
        selected={folderSelected}
        details={folderDetails}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('mock-has-access-row')).toHaveAttribute(
      'data-uri',
      'https://pod/app/docs/',
    );
  });

  it('passes the description through to EditableDescription', () => {
    render(
      <DetailPanel
        open
        selected={fileSelected}
        details={{ ...fileDetails, description: 'The Q1 report' }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('mock-editable-description')).toHaveAttribute(
      'data-initial',
      'The Q1 report',
    );
  });

  it('renders the Pod URI row with the resource URI', () => {
    render(
      <DetailPanel
        open
        selected={fileSelected}
        details={fileDetails}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('https://pod/app/report/')).toBeInTheDocument();
  });

  it('renders the Created row when details.created is set', () => {
    render(
      <DetailPanel
        open
        selected={fileSelected}
        details={{ ...fileDetails, created: '2026-01-15T00:00:00Z' }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/created/i)).toBeInTheDocument();
  });

  it('renders an <img> preview for image files when a previewUrl is available', () => {
    mockPreviewUrl = 'blob:preview-image';
    const { container } = render(
      <DetailPanel
        open
        selected={fileSelected}
        details={{ ...fileDetails, mediaType: 'image/png', name: 'pic.png' }}
        onClose={vi.fn()}
      />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('blob:preview-image');
    mockPreviewUrl = undefined;
  });

  it('renders an <iframe> preview for PDF documents when a previewUrl is available', () => {
    mockPreviewUrl = 'blob:preview-pdf';
    const { container } = render(
      <DetailPanel
        open
        selected={fileSelected}
        details={{ ...fileDetails, mediaType: 'application/pdf' }}
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector('iframe')).not.toBeNull();
    mockPreviewUrl = undefined;
  });

  it('renders a <video> preview for video files when a previewUrl is available', () => {
    mockPreviewUrl = 'blob:preview-video';
    const { container } = render(
      <DetailPanel
        open
        selected={fileSelected}
        details={{ ...fileDetails, mediaType: 'video/mp4' }}
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector('video')).not.toBeNull();
    mockPreviewUrl = undefined;
  });

  it('renders an <audio> preview for audio files when a previewUrl is available', () => {
    mockPreviewUrl = 'blob:preview-audio';
    const { container } = render(
      <DetailPanel
        open
        selected={fileSelected}
        details={{ ...fileDetails, mediaType: 'audio/mpeg' }}
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector('audio')).not.toBeNull();
    mockPreviewUrl = undefined;
  });

  it('falls back to icon thumbnail when previewUrl is available but mediaType is unsupported', () => {
    mockPreviewUrl = 'blob:preview-archive';
    const { container } = render(
      <DetailPanel
        open
        selected={fileSelected}
        details={{ ...fileDetails, mediaType: 'application/zip' }}
        onClose={vi.fn()}
      />,
    );
    // No media element; should show the icon thumbnail instead
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('audio')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(
      container.querySelector('[data-preview-kind="icon"]'),
    ).not.toBeNull();
    mockPreviewUrl = undefined;
  });

  it('shows icon thumbnail when previewUrl is absent (no container resource)', () => {
    mockPreviewUrl = undefined;
    const { container } = render(
      <DetailPanel
        open
        selected={fileSelected}
        details={{ ...fileDetails, mediaType: 'image/png' }}
        onClose={vi.fn()}
      />,
    );
    // useResource returns null → isSolidContainer returns false → binaryUri is undefined
    expect(container.querySelector('img')).toBeNull();
    expect(
      container.querySelector('[data-preview-kind="icon"]'),
    ).not.toBeNull();
  });

  it('uses details.binaryUri directly when the catalog already knows it (no container scan)', () => {
    mockPreviewUrl = 'blob:preview-direct';
    mockPreviewCalls = [];
    mockResource = null;
    mockIsContainer = () => false;
    render(
      <DetailPanel
        open
        selected={fileSelected}
        details={{
          ...fileDetails,
          mediaType: 'image/png',
          binaryUri: 'https://pod/app/report/photo.png',
        }}
        onClose={vi.fn()}
      />,
    );
    expect(mockPreviewCalls).toContain('https://pod/app/report/photo.png');
    mockPreviewUrl = undefined;
  });

  it('renders the Type row with the empty-cell placeholder when mediaType is missing', () => {
    render(
      <DetailPanel
        open
        selected={fileSelected}
        details={{ ...fileDetails, mediaType: undefined }}
        onClose={vi.fn()}
      />,
    );
    // No mediaType, no preview kind, no preview element.
    expect(screen.queryByText('application/pdf')).not.toBeInTheDocument();
  });

  it('falls back to a container scan when binaryUri is missing and picks the non-index leaf', () => {
    mockPreviewUrl = 'blob:preview-scanned';
    mockPreviewCalls = [];
    const binaryChild = { uri: 'https://pod/app/report/photo.png' };
    const indexChild = { uri: 'https://pod/app/report/index.ttl' };
    mockResource = {
      uri: 'https://pod/app/report/',
      children: () => [binaryChild, indexChild],
    };
    mockIsContainer = (entry: unknown) => {
      if (entry === binaryChild || entry === indexChild) return false;
      return entry === mockResource;
    };

    render(
      <DetailPanel
        open
        selected={fileSelected}
        details={{ ...fileDetails, mediaType: 'image/png', binaryUri: undefined }}
        onClose={vi.fn()}
      />,
    );

    expect(mockPreviewCalls).toContain('https://pod/app/report/photo.png');

    mockPreviewUrl = undefined;
    mockResource = null;
    mockIsContainer = () => false;
  });
});

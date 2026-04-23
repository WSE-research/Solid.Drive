import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { SolidContainer, SolidLeaf } from '@ldo/connected-solid';
import { DriveFileList } from '../FileExplorer-file/DriveFileList';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

vi.mock('@ldo/solid-react', () => ({
  useResource: vi.fn(() => null),
}));

vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isSolidContainer: vi.fn((r: unknown) => !!(r as Record<string, unknown>)?.children),
}));

vi.mock('@/features/file-explorer/components/FileCard', () => ({
  FileCard: ({ containerUri, catalogUri }: { containerUri: string; catalogUri: string }) => (
    <div data-testid="file-card" data-uri={containerUri} data-catalog={catalogUri} />
  ),
}));

vi.mock('@/features/file-explorer/components/FolderEntry', () => ({
  FolderEntry: ({ uri, onNavigate }: { uri: string; onNavigate: (uri: string) => void }) => (
    <div data-testid="folder-entry" data-uri={uri} onClick={() => onNavigate(uri)} />
  ),
}));

const mockOnNavigate = vi.fn();
const mockOnDownload = vi.fn();

const makeFolders = (uris: string[]): SolidContainer[] =>
  uris.map((uri) => ({ uri, children: () => [] })) as unknown as SolidContainer[];

const makeLeaves = (uris: string[]): SolidLeaf[] =>
  uris.map((uri) => ({ uri, type: 'SolidLeaf' })) as unknown as SolidLeaf[];

import { useResource } from '@ldo/solid-react';

describe('DriveFileList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders empty state for app folder when no entries', () => {
    render(
      <DriveFileList
        folderEntries={[]}
        leafEntries={[]}
        isInAppFolder={true}
        catalogUri="https://pod.example/catalog.ttl"
        catalogContainerUris={new Set()}
        onNavigate={mockOnNavigate}
        onDownload={mockOnDownload}
      />
    );
    expect(screen.getByText('fileExplorer.noFilesYet')).toBeInTheDocument();
  });

  it('renders empty state for non-app folder when no entries', () => {
    render(
      <DriveFileList
        folderEntries={[]}
        leafEntries={[]}
        isInAppFolder={false}
        catalogUri="https://pod.example/catalog.ttl"
        catalogContainerUris={new Set()}
        onNavigate={mockOnNavigate}
        onDownload={mockOnDownload}
      />
    );
    expect(screen.getByText('fileExplorer.emptyFolder')).toBeInTheDocument();
  });

  it('renders FileCard for folder entries when in catalog', () => {
    const folders = makeFolders(['https://pod.example/app/doc1/', 'https://pod.example/app/doc2/']);
    render(
      <DriveFileList
        folderEntries={folders}
        leafEntries={[]}
        isInAppFolder={true}
        catalogUri="https://pod.example/catalog.ttl"
        catalogContainerUris={new Set(['https://pod.example/app/doc1/', 'https://pod.example/app/doc2/'])}
        onNavigate={mockOnNavigate}
        onDownload={mockOnDownload}
      />
    );
    const cards = screen.getAllByTestId('file-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].getAttribute('data-uri')).toBe('https://pod.example/app/doc1/');
    expect(cards[0].getAttribute('data-catalog')).toBe('https://pod.example/catalog.ttl');
  });

  it('renders FileCard via structural detection when container has index.ttl', () => {
    const folderUri = 'https://pod.example/public/sub/1.jpg/';
    const folders = makeFolders([folderUri]);
    // Simulate the loaded resource having index.ttl as a child leaf
    const mockResource = {
      uri: folderUri,
      children: () => [
        { uri: `${folderUri}index.ttl` },   // leaf (no children method)
        { uri: `${folderUri}1.jpg` },
      ],
    };
    vi.mocked(useResource).mockReturnValueOnce(mockResource as unknown as ReturnType<typeof useResource>);

    render(
      <DriveFileList
        folderEntries={folders}
        leafEntries={[]}
        isInAppFolder={false}
        catalogUri="https://pod.example/catalog.ttl"
        catalogContainerUris={new Set()}
        onNavigate={mockOnNavigate}
        onDownload={mockOnDownload}
      />
    );
    expect(screen.getByTestId('file-card')).toBeInTheDocument();
    expect(screen.getByTestId('file-card').getAttribute('data-uri')).toBe(folderUri);
  });

  it('renders FolderEntry for folder entries not in catalog and no index.ttl', () => {
    const folders = makeFolders(['https://pod.example/public/', 'https://pod.example/private/']);
    render(
      <DriveFileList
        folderEntries={folders}
        leafEntries={[]}
        isInAppFolder={false}
        catalogUri="https://pod.example/catalog.ttl"
        catalogContainerUris={new Set()}
        onNavigate={mockOnNavigate}
        onDownload={mockOnDownload}
      />
    );
    const entries = screen.getAllByTestId('folder-entry');
    expect(entries).toHaveLength(2);
  });

  it('FolderEntry triggers onNavigate when clicked', () => {
    const folders = makeFolders(['https://pod.example/public/']);
    render(
      <DriveFileList
        folderEntries={folders}
        leafEntries={[]}
        isInAppFolder={false}
        catalogUri=""
        catalogContainerUris={new Set()}
        onNavigate={mockOnNavigate}
        onDownload={mockOnDownload}
      />
    );
    fireEvent.click(screen.getByTestId('folder-entry'));
    expect(mockOnNavigate).toHaveBeenCalledWith('https://pod.example/public/');
  });

  it('renders leaf entries with decoded filenames and download buttons', () => {
    const leaves = makeLeaves(['https://pod.example/app/hello%20world.pdf']);
    render(
      <DriveFileList
        folderEntries={[]}
        leafEntries={leaves}
        isInAppFolder={true}
        catalogUri=""
        catalogContainerUris={new Set()}
        onNavigate={mockOnNavigate}
        onDownload={mockOnDownload}
      />
    );
    expect(screen.getByText('hello world.pdf')).toBeInTheDocument();
    expect(screen.getByText('fileExplorer.download')).toBeInTheDocument();
  });

  it('download button calls onDownload with entry and decoded filename', () => {
    const leaves = makeLeaves(['https://pod.example/app/file.txt']);
    render(
      <DriveFileList
        folderEntries={[]}
        leafEntries={leaves}
        isInAppFolder={true}
        catalogUri=""
        catalogContainerUris={new Set()}
        onNavigate={mockOnNavigate}
        onDownload={mockOnDownload}
      />
    );
    fireEvent.click(screen.getByText('fileExplorer.download'));
    expect(mockOnDownload).toHaveBeenCalledWith(leaves[0], 'file.txt');
  });

  it('renders FolderEntry when resource is loaded but is not a SolidContainer', () => {
    const folderUri = 'https://pod.example/public/docs/';
    const folders = makeFolders([folderUri]);
    const mockNonContainerResource = { uri: folderUri };
    vi.mocked(useResource).mockReturnValueOnce(mockNonContainerResource as unknown as ReturnType<typeof useResource>);

    render(
      <DriveFileList
        folderEntries={folders}
        leafEntries={[]}
        isInAppFolder={false}
        catalogUri="https://pod.example/catalog.ttl"
        catalogContainerUris={new Set()}
        onNavigate={mockOnNavigate}
        onDownload={mockOnDownload}
      />
    );
    expect(screen.getByTestId('folder-entry')).toBeInTheDocument();
  });

  it('renders both folders and leaves together', () => {
    const folders = makeFolders(['https://pod.example/app/folder/']);
    const leaves = makeLeaves(['https://pod.example/app/file.txt']);
    render(
      <DriveFileList
        folderEntries={folders}
        leafEntries={leaves}
        isInAppFolder={true}
        catalogUri="cat"
        catalogContainerUris={new Set(['https://pod.example/app/folder/'])}
        onNavigate={mockOnNavigate}
        onDownload={mockOnDownload}
      />
    );
    expect(screen.getByTestId('file-card')).toBeInTheDocument();
    expect(screen.getByText('file.txt')).toBeInTheDocument();
  });
});

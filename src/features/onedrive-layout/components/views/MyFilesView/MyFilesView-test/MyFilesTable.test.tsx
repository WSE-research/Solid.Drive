import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CatalogEntry } from '@/types';
import type { SortState } from '@/features/onedrive-layout/hooks/useMyFilesSort';
import type { SolidContainer, SolidLeaf } from '@ldo/connected-solid';

const mockUseResource = vi.fn();
vi.mock('@ldo/solid-react', () => ({
  useResource: (uri: string) => mockUseResource(uri),
}));

vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isSolidContainer: (entry: { uri?: string } | undefined) =>
    typeof entry?.uri === 'string' && entry.uri.endsWith('/'),
}));

vi.mock('../MyFilesView-file/SharingCell', () => ({
  SharingCell: ({ uri }: { uri: string }) => (
    <span data-testid="sharing-cell" data-uri={uri} />
  ),
}));

import { MyFilesTable } from '../MyFilesView-file/MyFilesTable';

const sortByName: SortState = { key: 'name', direction: 'asc' };

// Minimal stubs for the table — the production types carry many LDO-internal
// members the table never touches, so we narrow to the surface it does use.
const makeContainer = (uri: string, children: { uri: string }[] = []) =>
  ({ uri, children: () => children }) as unknown as SolidContainer;

const makeLeaf = (uri: string) =>
  ({ uri }) as unknown as SolidLeaf;

const catalogEntry = (over: Partial<CatalogEntry> = {}): CatalogEntry => ({
  uri: 'https://pod/app/file1/index.ttl',
  conformsTo: 'https://schema.org/MediaObject',
  title: 'report.pdf',
  description: '',
  modified: '2026-04-01T00:00:00Z',
  publisher: 'https://owner/me',
  mediaType: 'application/pdf',
  byteSize: 12345,
  accessURL: 'https://pod/app/file1/binary',
  ...over,
});

describe('MyFilesTable — FolderRow as catalog file', () => {
  it('treats a folder URI in catalogContainerUris as a file row using the catalog title', () => {
    mockUseResource.mockReturnValue(makeContainer('https://pod/app/file1/'));
    render(
      <MyFilesTable
        folderEntries={[makeContainer('https://pod/app/file1/')]}
        leafEntries={[]}
        catalogEntries={[catalogEntry()]}
        catalogContainerUris={new Set(['https://pod/app/file1/'])}
        sort={sortByName}
        onNavigate={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
  });

  it('treats a folder containing index.ttl as a file row even without a catalog hit', () => {
    mockUseResource.mockReturnValue(
      makeContainer('https://pod/app/lonely/', [
        { uri: 'https://pod/app/lonely/index.ttl' },
      ]),
    );
    render(
      <MyFilesTable
        folderEntries={[makeContainer('https://pod/app/lonely/')]}
        leafEntries={[]}
        catalogEntries={[]}
        catalogContainerUris={new Set()}
        sort={sortByName}
        onNavigate={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('lonely')).toBeInTheDocument();
    expect(
      screen.getByRole('row', { name: /lonely/i }).className,
    ).toContain('odl-files-row--file');
  });

  it('clicking a catalog-backed folder row triggers onSelect (not onNavigate)', async () => {
    const user = userEvent.setup();
    mockUseResource.mockReturnValue(makeContainer('https://pod/app/file1/'));
    const onNavigate = vi.fn();
    const onSelect = vi.fn();
    render(
      <MyFilesTable
        folderEntries={[makeContainer('https://pod/app/file1/')]}
        leafEntries={[]}
        catalogEntries={[catalogEntry()]}
        catalogContainerUris={new Set(['https://pod/app/file1/'])}
        sort={sortByName}
        onNavigate={onNavigate}
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByRole('row', { name: /report\.pdf/i }));
    expect(onSelect).toHaveBeenCalledWith({
      kind: 'file',
      uri: 'https://pod/app/file1/',
      name: 'report.pdf',
    });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('Enter on a catalog-backed folder row also triggers onSelect', () => {
    mockUseResource.mockReturnValue(makeContainer('https://pod/app/file1/'));
    const onSelect = vi.fn();
    render(
      <MyFilesTable
        folderEntries={[makeContainer('https://pod/app/file1/')]}
        leafEntries={[]}
        catalogEntries={[catalogEntry()]}
        catalogContainerUris={new Set(['https://pod/app/file1/'])}
        sort={sortByName}
        onNavigate={vi.fn()}
        onSelect={onSelect}
      />,
    );
    fireEvent.keyDown(screen.getByRole('row', { name: /report\.pdf/i }), {
      key: 'Enter',
    });
    expect(onSelect).toHaveBeenCalled();
  });

  it('marks a catalog-backed folder row as aria-selected when its URI matches selectedUri', () => {
    mockUseResource.mockReturnValue(makeContainer('https://pod/app/file1/'));
    render(
      <MyFilesTable
        folderEntries={[makeContainer('https://pod/app/file1/')]}
        leafEntries={[]}
        catalogEntries={[catalogEntry()]}
        catalogContainerUris={new Set(['https://pod/app/file1/'])}
        sort={sortByName}
        selectedUri="https://pod/app/file1/"
        onNavigate={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const row = screen.getByRole('row', { name: /report\.pdf/i });
    expect(row).toHaveAttribute('aria-selected', 'true');
    expect(row.className).toContain('odl-files-row--active');
  });
});

describe('MyFilesTable — FolderRow as bare folder', () => {
  it('renders a bare folder with item count and navigates on click', async () => {
    const user = userEvent.setup();
    mockUseResource.mockReturnValue(
      makeContainer('https://pod/app/docs/', [
        { uri: 'https://pod/app/docs/a' },
        { uri: 'https://pod/app/docs/b' },
      ]),
    );
    const onNavigate = vi.fn();
    render(
      <MyFilesTable
        folderEntries={[makeContainer('https://pod/app/docs/')]}
        leafEntries={[]}
        catalogEntries={[]}
        catalogContainerUris={new Set()}
        sort={sortByName}
        onNavigate={onNavigate}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('docs')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    await user.click(screen.getByRole('row', { name: /docs/i }));
    expect(onNavigate).toHaveBeenCalledWith('https://pod/app/docs/', 'docs');
  });

  it('Enter on a bare folder row also navigates', () => {
    mockUseResource.mockReturnValue(makeContainer('https://pod/app/docs/'));
    const onNavigate = vi.fn();
    render(
      <MyFilesTable
        folderEntries={[makeContainer('https://pod/app/docs/')]}
        leafEntries={[]}
        catalogEntries={[]}
        catalogContainerUris={new Set()}
        sort={sortByName}
        onNavigate={onNavigate}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.keyDown(screen.getByRole('row', { name: /docs/i }), {
      key: 'Enter',
    });
    expect(onNavigate).toHaveBeenCalled();
  });

  it('drag-and-drop on a bare folder fires onFolderDrop with the dropped files', () => {
    mockUseResource.mockReturnValue(makeContainer('https://pod/app/docs/'));
    const onFolderDrop = vi.fn();
    const onFolderDragOverChange = vi.fn();
    render(
      <MyFilesTable
        folderEntries={[makeContainer('https://pod/app/docs/')]}
        leafEntries={[]}
        catalogEntries={[]}
        catalogContainerUris={new Set()}
        sort={sortByName}
        onNavigate={vi.fn()}
        onSelect={vi.fn()}
        onFolderDrop={onFolderDrop}
        onFolderDragOverChange={onFolderDragOverChange}
      />,
    );
    const row = screen.getByRole('row', { name: /docs/i });
    fireEvent.dragEnter(row, { dataTransfer: { types: ['Files'] } });
    expect(onFolderDragOverChange).toHaveBeenCalledWith(true);
    fireEvent.dragOver(row, { dataTransfer: { types: ['Files'] } });
    fireEvent.dragLeave(row, { dataTransfer: { types: ['Files'] } });
    expect(onFolderDragOverChange).toHaveBeenLastCalledWith(false);

    const file = new File(['x'], 'a.txt', { type: 'text/plain' });
    fireEvent.drop(row, { dataTransfer: { files: [file], types: ['Files'] } });
    expect(onFolderDrop).toHaveBeenCalledWith(
      [file],
      'https://pod/app/docs/',
      expect.objectContaining({ files: expect.anything() }),
    );
  });

  it('non-Files drag types do not call the drag-over change callback', () => {
    mockUseResource.mockReturnValue(makeContainer('https://pod/app/docs/'));
    const onFolderDragOverChange = vi.fn();
    render(
      <MyFilesTable
        folderEntries={[makeContainer('https://pod/app/docs/')]}
        leafEntries={[]}
        catalogEntries={[]}
        catalogContainerUris={new Set()}
        sort={sortByName}
        onNavigate={vi.fn()}
        onSelect={vi.fn()}
        onFolderDrop={vi.fn()}
        onFolderDragOverChange={onFolderDragOverChange}
      />,
    );
    fireEvent.dragEnter(screen.getByRole('row', { name: /docs/i }), {
      dataTransfer: { types: ['text/plain'] },
    });
    fireEvent.dragOver(screen.getByRole('row', { name: /docs/i }), {
      dataTransfer: { types: ['text/plain'] },
    });
    expect(onFolderDragOverChange).not.toHaveBeenCalled();
  });

  it('renders a bare folder with item count 0 when the resolved resource is null', () => {
    mockUseResource.mockReturnValue(null);
    render(
      <MyFilesTable
        folderEntries={[makeContainer('https://pod/app/loading/')]}
        leafEntries={[]}
        catalogEntries={[]}
        catalogContainerUris={new Set()}
        sort={sortByName}
        onNavigate={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const row = screen.getByRole('row', { name: /loading/i });
    expect(row).toBeInTheDocument();
    expect(row.className).toContain('odl-files-row--folder');
    expect(row.textContent).toContain('0');
  });

  it('renders a bare folder with item count 0 when the resolved resource is not a container', () => {
    mockUseResource.mockReturnValue({ uri: 'https://pod/app/loading' });
    render(
      <MyFilesTable
        folderEntries={[makeContainer('https://pod/app/loading/')]}
        leafEntries={[]}
        catalogEntries={[]}
        catalogContainerUris={new Set()}
        sort={sortByName}
        onNavigate={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const row = screen.getByRole('row', { name: /loading/i });
    expect(row.className).toContain('odl-files-row--folder');
    expect(row.textContent).toContain('0');
  });
});

describe('MyFilesTable — LeafRow', () => {
  it('renders a leaf file row using the URI tail as the name', async () => {
    const user = userEvent.setup();
    mockUseResource.mockReturnValue(makeContainer('https://pod/app/'));
    const onSelect = vi.fn();
    render(
      <MyFilesTable
        folderEntries={[]}
        leafEntries={[makeLeaf('https://pod/app/notes.txt')]}
        catalogEntries={[]}
        catalogContainerUris={new Set()}
        sort={sortByName}
        onNavigate={vi.fn()}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText('notes.txt')).toBeInTheDocument();
    await user.click(screen.getByRole('row', { name: /notes\.txt/i }));
    expect(onSelect).toHaveBeenCalledWith({
      kind: 'file',
      uri: 'https://pod/app/notes.txt',
      name: 'notes.txt',
    });
  });

  it('Enter on a leaf row also triggers onSelect', () => {
    mockUseResource.mockReturnValue(makeContainer('https://pod/app/'));
    const onSelect = vi.fn();
    render(
      <MyFilesTable
        folderEntries={[]}
        leafEntries={[makeLeaf('https://pod/app/notes.txt')]}
        catalogEntries={[]}
        catalogContainerUris={new Set()}
        sort={sortByName}
        onNavigate={vi.fn()}
        onSelect={onSelect}
      />,
    );
    fireEvent.keyDown(screen.getByRole('row', { name: /notes\.txt/i }), {
      key: 'Enter',
    });
    expect(onSelect).toHaveBeenCalled();
  });

  it('marks a leaf row as aria-selected when its URI matches selectedUri', () => {
    mockUseResource.mockReturnValue(makeContainer('https://pod/app/'));
    render(
      <MyFilesTable
        folderEntries={[]}
        leafEntries={[makeLeaf('https://pod/app/notes.txt')]}
        catalogEntries={[]}
        catalogContainerUris={new Set()}
        sort={sortByName}
        selectedUri="https://pod/app/notes.txt"
        onNavigate={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole('row', { name: /notes\.txt/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});

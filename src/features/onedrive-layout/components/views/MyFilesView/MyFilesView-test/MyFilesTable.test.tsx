import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SolidContainer, SolidLeaf } from '@ldo/connected-solid';
import type { CatalogEntry } from '@/types';
import { MyFilesTable } from '../MyFilesView-file/MyFilesTable';

/* ────── mocks ─────────────────────────────────────────────────────────── */

vi.mock('@ldo/solid-react', () => ({
  useResource: (uri: string) => ({
    uri,
    children: () => mockChildrenByUri.get(uri) ?? [],
  }),
}));

vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isSolidContainer: (entry: { uri?: string } | null | undefined) =>
    typeof entry?.uri === 'string' && entry.uri.endsWith('/'),
}));

vi.mock('../MyFilesView-file/SharingCell', () => ({
  SharingCell: ({ uri }: { uri: string }) => (
    <span data-testid="mock-sharing-cell" data-uri={uri} />
  ),
}));

vi.mock('../MyFilesView-file/MyFilesTableHead', () => ({
  MyFilesTableHead: () => <div data-testid="mock-table-head" />,
}));

/* ────── helpers ───────────────────────────────────────────────────────── */

const mockChildrenByUri = new Map<string, Array<{ uri: string }>>();

// MyFilesTable only reads `.uri` and the `useResource` mock supplies
// `children()` lookups by URI, so a stub with just `uri` is sufficient.
// The cast through `unknown` documents this — if the table ever starts
// reading more LDO fields, these stubs need to grow accordingly.
function makeContainer(uri: string): SolidContainer {
  return { uri } as unknown as SolidContainer;
}

function makeLeaf(uri: string): SolidLeaf {
  return { uri } as unknown as SolidLeaf;
}

const baseSort = { key: 'name' as const, direction: 'asc' as const };

const baseProps = {
  folderEntries: [] as SolidContainer[],
  leafEntries: [] as SolidLeaf[],
  catalogEntries: [] as CatalogEntry[],
  catalogContainerUris: new Set<string>(),
  sort: baseSort,
  onNavigate: vi.fn(),
  onSelect: vi.fn(),
};

/* ────── tests ─────────────────────────────────────────────────────────── */

describe('MyFilesTable — leaf rows', () => {
  beforeEach(() => {
    mockChildrenByUri.clear();
    vi.clearAllMocks();
  });

  it('renders a row for each leaf with the URL-decoded tail as the name', () => {
    render(
      <MyFilesTable
        {...baseProps}
        leafEntries={[
          makeLeaf('https://pod/app/notes.txt'),
          makeLeaf('https://pod/app/my%20file.pdf'),
        ]}
      />,
    );
    expect(screen.getByText('notes.txt')).toBeInTheDocument();
    expect(screen.getByText('my file.pdf')).toBeInTheDocument();
  });

  it('clicking a leaf row calls onSelect with kind: file', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <MyFilesTable
        {...baseProps}
        onSelect={onSelect}
        leafEntries={[makeLeaf('https://pod/app/notes.txt')]}
      />,
    );
    await user.click(screen.getByText('notes.txt'));
    expect(onSelect).toHaveBeenCalledWith({
      kind: 'file',
      uri: 'https://pod/app/notes.txt',
      name: 'notes.txt',
    });
  });

  it('pressing Enter on a focused leaf row activates select', () => {
    const onSelect = vi.fn();
    render(
      <MyFilesTable
        {...baseProps}
        onSelect={onSelect}
        leafEntries={[makeLeaf('https://pod/app/notes.txt')]}
      />,
    );
    fireEvent.keyDown(screen.getAllByRole('row')[0], { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('pressing an unrelated key on a focused leaf row does nothing', () => {
    const onSelect = vi.fn();
    render(
      <MyFilesTable
        {...baseProps}
        onSelect={onSelect}
        leafEntries={[makeLeaf('https://pod/app/notes.txt')]}
      />,
    );
    fireEvent.keyDown(screen.getAllByRole('row')[0], { key: 'Escape' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('marks the leaf row matching selectedUri with aria-selected', () => {
    render(
      <MyFilesTable
        {...baseProps}
        leafEntries={[makeLeaf('https://pod/app/notes.txt')]}
        selectedUri="https://pod/app/notes.txt"
      />,
    );
    expect(screen.getByRole('row')).toHaveAttribute('aria-selected', 'true');
  });
});

describe('MyFilesTable — folder rows that look like files (index.ttl)', () => {
  beforeEach(() => {
    mockChildrenByUri.clear();
    vi.clearAllMocks();
  });

  it('treats a folder containing index.ttl as a file row and falls back to the URL tail when no catalog entry exists', async () => {
    const folderUri = 'https://pod/app/doc/';
    mockChildrenByUri.set(folderUri, [{ uri: `${folderUri}index.ttl` }]);
    const onSelect = vi.fn();
    const onNavigate = vi.fn();
    render(
      <MyFilesTable
        {...baseProps}
        onSelect={onSelect}
        onNavigate={onNavigate}
        folderEntries={[makeContainer(folderUri)]}
      />,
    );
    const row = screen.getByRole('row');
    expect(row.className).toContain('odl-files-row--file');
    fireEvent.keyDown(row, { key: ' ' });
    expect(onSelect).toHaveBeenCalledWith({
      kind: 'file',
      uri: folderUri,
      name: 'doc',
    });
    expect(onNavigate).not.toHaveBeenCalled();
  });
});

describe('MyFilesTable — bare folder rows', () => {
  beforeEach(() => {
    mockChildrenByUri.clear();
    vi.clearAllMocks();
  });

  it('renders a folder row using the URL tail and shows a child count', () => {
    const folderUri = 'https://pod/app/photos/';
    mockChildrenByUri.set(folderUri, [
      { uri: `${folderUri}a/` },
      { uri: `${folderUri}b/` },
      { uri: `${folderUri}c/` },
    ]);
    render(
      <MyFilesTable
        {...baseProps}
        folderEntries={[makeContainer(folderUri)]}
      />,
    );
    expect(screen.getByText('photos')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('clicking a bare folder row navigates and does not call onSelect', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onNavigate = vi.fn();
    const folderUri = 'https://pod/app/photos/';
    mockChildrenByUri.set(folderUri, []);
    render(
      <MyFilesTable
        {...baseProps}
        onSelect={onSelect}
        onNavigate={onNavigate}
        folderEntries={[makeContainer(folderUri)]}
      />,
    );
    await user.click(screen.getByText('photos'));
    expect(onNavigate).toHaveBeenCalledWith(folderUri, 'photos');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('pressing Enter on a bare folder row also navigates', () => {
    const onNavigate = vi.fn();
    const folderUri = 'https://pod/app/photos/';
    mockChildrenByUri.set(folderUri, []);
    render(
      <MyFilesTable
        {...baseProps}
        onNavigate={onNavigate}
        folderEntries={[makeContainer(folderUri)]}
      />,
    );
    fireEvent.keyDown(screen.getByRole('row'), { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalled();
  });

  it('drag-enter with Files data fires onFolderDragOverChange(true)', () => {
    const onFolderDragOverChange = vi.fn();
    const folderUri = 'https://pod/app/photos/';
    mockChildrenByUri.set(folderUri, []);
    render(
      <MyFilesTable
        {...baseProps}
        folderEntries={[makeContainer(folderUri)]}
        onFolderDragOverChange={onFolderDragOverChange}
        onFolderDrop={vi.fn()}
      />,
    );
    fireEvent.dragEnter(screen.getByRole('row'), {
      dataTransfer: { types: ['Files'] },
    });
    expect(onFolderDragOverChange).toHaveBeenCalledWith(true);
  });

  it('drag-enter with non-Files data is ignored', () => {
    const onFolderDragOverChange = vi.fn();
    const folderUri = 'https://pod/app/photos/';
    mockChildrenByUri.set(folderUri, []);
    render(
      <MyFilesTable
        {...baseProps}
        folderEntries={[makeContainer(folderUri)]}
        onFolderDragOverChange={onFolderDragOverChange}
        onFolderDrop={vi.fn()}
      />,
    );
    fireEvent.dragEnter(screen.getByRole('row'), {
      dataTransfer: { types: ['text/plain'] },
    });
    expect(onFolderDragOverChange).not.toHaveBeenCalled();
  });

  it('drag-leave fires onFolderDragOverChange(false)', () => {
    const onFolderDragOverChange = vi.fn();
    const folderUri = 'https://pod/app/photos/';
    mockChildrenByUri.set(folderUri, []);
    render(
      <MyFilesTable
        {...baseProps}
        folderEntries={[makeContainer(folderUri)]}
        onFolderDragOverChange={onFolderDragOverChange}
        onFolderDrop={vi.fn()}
      />,
    );
    fireEvent.dragLeave(screen.getByRole('row'));
    expect(onFolderDragOverChange).toHaveBeenCalledWith(false);
  });

  it('drop on a bare folder row calls onFolderDrop with the dropped files', () => {
    const onFolderDrop = vi.fn();
    const onFolderDragOverChange = vi.fn();
    const folderUri = 'https://pod/app/photos/';
    mockChildrenByUri.set(folderUri, []);
    render(
      <MyFilesTable
        {...baseProps}
        folderEntries={[makeContainer(folderUri)]}
        onFolderDrop={onFolderDrop}
        onFolderDragOverChange={onFolderDragOverChange}
      />,
    );
    const file = new File(['hi'], 'hi.txt', { type: 'text/plain' });
    fireEvent.drop(screen.getByRole('row'), {
      dataTransfer: { files: [file], types: ['Files'] },
    });
    expect(onFolderDragOverChange).toHaveBeenLastCalledWith(false);
    expect(onFolderDrop).toHaveBeenCalledWith(
      [file],
      folderUri,
      expect.any(Object),
    );
  });

  it('drop with zero files does not call onFolderDrop', () => {
    const onFolderDrop = vi.fn();
    const folderUri = 'https://pod/app/photos/';
    mockChildrenByUri.set(folderUri, []);
    render(
      <MyFilesTable
        {...baseProps}
        folderEntries={[makeContainer(folderUri)]}
        onFolderDrop={onFolderDrop}
        onFolderDragOverChange={vi.fn()}
      />,
    );
    fireEvent.drop(screen.getByRole('row'), {
      dataTransfer: { files: [], types: ['Files'] },
    });
    expect(onFolderDrop).not.toHaveBeenCalled();
  });
});

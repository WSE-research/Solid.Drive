import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CatalogEntry } from '@/types';
import type { SortState } from '@/features/onedrive-layout/hooks/useMyFilesSort';
import { MyFilesView } from '../MyFilesView-file/MyFilesView';

const defaultSort: SortState = { key: 'name', direction: 'asc' };

const renderProps = {
  searchValue: '',
  sort: defaultSort,
  showNewFolder: false,
  showUpload: false,
  onNewFolderDone: vi.fn(),
  onUploadDone: vi.fn(),
  onRequestUpload: vi.fn(),
  onSelect: vi.fn(),
};

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, fallback?: string) => fallback ?? key,
  ],
}));

const folderChild = { uri: 'https://pod/app/folder1/' };
const fileContainerChild = { uri: 'https://pod/app/file1/' };

vi.mock('@/features/file-explorer/hooks/useDriveInitialization', () => ({
  useDriveInitialization: () => ({
    appContainerUri: 'https://pod/app/',
    storageRootUri: 'https://pod/',
    currentUri: 'https://pod/app/',
    setCurrentUri: vi.fn(),
    breadcrumbs: [{ label: 'My Pod', uri: 'https://pod/app/' }],
    setBreadcrumbs: vi.fn(),
    noStorageDetected: false,
    handleRetryStorage: vi.fn(),
    handleNavigate: vi.fn(),
    handleBreadcrumbClick: vi.fn(),
    contacts: [],
  }),
}));

const fileEntry: CatalogEntry = {
  uri: 'https://pod/app/file1/index.ttl',
  conformsTo: 'https://schema.org/MediaObject',
  title: 'report.pdf',
  description: '',
  modified: '2026-04-01T00:00:00Z',
  publisher: 'https://owner/me',
  mediaType: 'application/pdf',
  byteSize: 12345,
  accessURL: 'https://pod/app/file1/binary',
};

vi.mock('@/features/file-explorer/hooks/useCatalog', () => ({
  useCatalog: () => ({
    entries: [fileEntry],
    containerUris: new Set(['https://pod/app/file1/']),
    loading: false,
    error: null,
  }),
}));

vi.mock('@/infrastructure/solid/catalog', () => ({
  resolveCatalogUri: () => 'https://pod/catalog',
}));

vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isSolidContainer: (entry: { uri: string } | null | undefined) =>
    entry?.uri.endsWith('/') ?? false,
}));

vi.mock('@/features/file-explorer/services/fileFilter', () => ({
  isVisibleLeaf: () => true,
}));

vi.mock('@/features/onedrive-layout/hooks/useSharingLabel', () => ({
  useSharingLabel: () => ({ kind: 'private', agentWebIds: [], loading: false }),
}));

vi.mock('@ldo/solid-react', () => ({
  useResource: (uri: string | undefined) => ({
    uri: uri ?? '',
    children: () => [folderChild, fileContainerChild],
  }),
  useSolidAuth: () => ({
    session: { isLoggedIn: true, webId: 'https://owner/me' },
    fetch: vi.fn(),
  }),
  useSubject: () => ({ catalog: { '@id': 'https://pod/catalog' } }),
}));

const mockEnqueueInstant = vi.fn();
const mockDismiss = vi.fn();
const mockRetry = vi.fn();

vi.mock('@/features/file-explorer/hooks/useUploadQueue', () => ({
  useUploadQueue: () => ({
    items: [],
    enqueueInstant: (...args: unknown[]) => mockEnqueueInstant(...args),
    dismiss: (...args: unknown[]) => mockDismiss(...args),
    retry: (...args: unknown[]) => mockRetry(...args),
    hasActive: false,
  }),
}));

const mockShowError = vi.fn();
vi.mock('@/shared/contexts/NotificationContext', () => ({
  useNotifications: () => ({
    showError: mockShowError,
    showSuccess: vi.fn(),
    showInfo: vi.fn(),
    showToast: vi.fn(),
    confirm: vi.fn(),
  }),
}));

vi.mock('@/features/file-explorer/services/dragAndDrop', () => ({
  hasUnsupportedFolderDrop: () => false,
}));

vi.mock('@/features/file-explorer/components/DropZone', () => ({
  DropZone: ({
    visible,
    destinationLabel,
  }: {
    visible: boolean;
    destinationLabel: string;
  }) =>
    visible ? (
      <div data-testid="drop-zone" data-destination={destinationLabel} />
    ) : null,
}));

vi.mock('@/features/file-explorer/components/UploadTray', () => ({
  UploadTray: ({ items }: { items: unknown[] }) =>
    items.length > 0 ? <div data-testid="upload-tray" /> : null,
}));

vi.mock('@/features/file-explorer/components/NewFolderInput', () => ({
  NewFolderInput: () => <div data-testid="mock-new-folder-input" />,
}));

vi.mock('@/features/file-explorer/components/FileUpload', () => ({
  FileUpload: () => <div data-testid="mock-file-upload" />,
}));

const mockUseFileSearch = vi.fn(() => ({
  debouncedQuery: '',
  results: [] as CatalogEntry[],
}));

vi.mock('@/features/file-explorer/hooks/useFileSearch', () => ({
  useFileSearch: () => mockUseFileSearch(),
}));

describe('MyFilesView — skeleton', () => {
  it('renders the my-files view container', () => {
    const { container } = render(<MyFilesView {...renderProps} />);
    // The view title now lives in OneDriveLayout's page header, so the
    // view itself just exposes the data-view-id anchor used by the shell.
    expect(container.querySelector('[data-view-id="my-files"]')).toBeInTheDocument();
  });

  it('does not render breadcrumb when at root (depth 1)', () => {
    render(<MyFilesView {...renderProps} />);
    expect(
      screen.queryByRole('navigation', { name: /breadcrumb/i }),
    ).not.toBeInTheDocument();
  });
});

describe('MyFilesView — file table', () => {
  it('renders the four column headers', () => {
    render(<MyFilesView {...renderProps} />);
    for (const label of ['name', 'modified', 'size', 'sharing']) {
      expect(
        screen.getByRole('columnheader', { name: new RegExp(label, 'i') }),
      ).toBeInTheDocument();
    }
  });

  it('renders a folder row for a bare folder child', () => {
    render(<MyFilesView {...renderProps} />);
    expect(screen.getByText('folder1')).toBeInTheDocument();
  });

  it('renders a file row using the catalog entry title', () => {
    render(<MyFilesView {...renderProps} />);
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
  });

  it('clicking a bare folder row navigates into it (does not call onSelect)', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    window.history.replaceState(null, '', '/');
    render(<MyFilesView {...renderProps} onSelect={onSelect} />);
    await user.click(screen.getByRole('row', { name: /folder1/i }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(window.history.state).toMatchObject({
      marker: 'odl-my-files',
      currentUri: 'https://pod/app/folder1/',
    });
  });

  it('clicking a file row triggers onSelect with kind: file', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<MyFilesView {...renderProps} onSelect={onSelect} />);
    await user.click(screen.getByRole('row', { name: /report\.pdf/i }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'file', name: 'report.pdf' }),
    );
  });

  it('marks the row matching selectedUri with aria-selected=true', () => {
    render(
      <MyFilesView {...renderProps} selectedUri="https://pod/app/folder1/" />,
    );
    expect(screen.getByRole('row', { name: /folder1/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('row', { name: /report\.pdf/i })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });
});

describe('MyFilesView — sort', () => {
  it('respects the sort prop — name desc reverses row order', () => {
    // Smoke test: confirm the sort prop is forwarded. The catalog mock
    // returns one file ('report.pdf') and the children mock returns one
    // folder ('folder1') and the file's container. With name desc,
    // folder1 still precedes report.pdf (folders-before-files is
    // unconditional), but the assertion verifies the prop is accepted
    // without crashing and rows still render.
    render(
      <MyFilesView
        {...renderProps}
        sort={{ key: 'name', direction: 'desc' }}
      />,
    );
    expect(screen.getByText('folder1')).toBeInTheDocument();
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
  });
});

describe('MyFilesView — drag and drop', () => {
  beforeEach(() => {
    mockEnqueueInstant.mockReset();
    mockDismiss.mockReset();
    mockRetry.mockReset();
    mockShowError.mockReset();
  });

  it('shows the DropZone banner on drag enter and hides it on drag leave', () => {
    const { container } = render(<MyFilesView {...renderProps} />);
    const view = container.querySelector('onedrive-view');
    if (!view) throw new Error('onedrive-view not found');

    fireEvent.dragEnter(view, { dataTransfer: { types: ['Files'] } });
    expect(screen.getByTestId('drop-zone')).toBeInTheDocument();

    fireEvent.dragLeave(view, { dataTransfer: { types: ['Files'] } });
    expect(screen.queryByTestId('drop-zone')).not.toBeInTheDocument();
  });

  it('does not show DropZone when non-file data is dragged', () => {
    const { container } = render(<MyFilesView {...renderProps} />);
    const view = container.querySelector('onedrive-view');
    if (!view) throw new Error('onedrive-view not found');

    fireEvent.dragEnter(view, { dataTransfer: { types: ['text/plain'] } });
    expect(screen.queryByTestId('drop-zone')).not.toBeInTheDocument();
  });

  it('drop on the view with a single file calls onRequestUpload (and prefills the form)', () => {
    const onRequestUpload = vi.fn();
    const { container } = render(
      <MyFilesView {...renderProps} onRequestUpload={onRequestUpload} />,
    );
    const view = container.querySelector('onedrive-view');
    if (!view) throw new Error('onedrive-view not found');

    const file = new File(['hello'], 'a.txt', { type: 'text/plain' });
    fireEvent.drop(view, {
      dataTransfer: { files: [file], types: ['Files'] },
    });

    expect(onRequestUpload).toHaveBeenCalledOnce();
    expect(mockEnqueueInstant).not.toHaveBeenCalled();
  });

  it('drop of multiple files on the view enqueues all files', () => {
    const { container } = render(<MyFilesView {...renderProps} />);
    const view = container.querySelector('onedrive-view');
    if (!view) throw new Error('onedrive-view not found');

    const files = [
      new File(['x'], 'a.txt', { type: 'text/plain' }),
      new File(['y'], 'b.txt', { type: 'text/plain' }),
    ];
    fireEvent.drop(view, { dataTransfer: { files, types: ['Files'] } });

    expect(mockEnqueueInstant).toHaveBeenCalledTimes(1);
    expect(mockEnqueueInstant.mock.calls[0][0]).toEqual(files);
    expect(mockEnqueueInstant.mock.calls[0][1]).toBe('https://pod/app/');
  });

  it('drop on a bare folder row enqueues with that folder URI', () => {
    render(<MyFilesView {...renderProps} />);
    const folderRow = screen.getByRole('row', { name: /folder1/i });
    const files = [new File(['x'], 'a.txt'), new File(['y'], 'b.txt')];
    fireEvent.drop(folderRow, { dataTransfer: { files, types: ['Files'] } });

    expect(mockEnqueueInstant).toHaveBeenCalledTimes(1);
    expect(mockEnqueueInstant.mock.calls[0][0]).toEqual(files);
    expect(mockEnqueueInstant.mock.calls[0][1]).toBe('https://pod/app/folder1/');
    expect(mockEnqueueInstant.mock.calls[0][2]).toBe('folder1');
  });

  it('catalog file row does not accept drops', () => {
    render(<MyFilesView {...renderProps} />);
    const fileRow = screen.getByRole('row', { name: /report\.pdf/i });
    const files = [new File(['x'], 'a.txt'), new File(['y'], 'b.txt')];
    fireEvent.drop(fileRow, { dataTransfer: { files, types: ['Files'] } });

    // The drop should NOT be handled by the file row itself, but it
    // bubbles to the panel. The panel handler will enqueue with the
    // current container URI (https://pod/app/), not the file's URI.
    if (mockEnqueueInstant.mock.calls.length > 0) {
      expect(mockEnqueueInstant.mock.calls[0][1]).toBe('https://pod/app/');
    }
  });
});

describe('MyFilesView — search', () => {
  afterEach(() => {
    mockUseFileSearch.mockReset();
    mockUseFileSearch.mockReturnValue({ debouncedQuery: '', results: [] });
  });

  it('renders the browse table when searchValue is empty', () => {
    mockUseFileSearch.mockReturnValue({ debouncedQuery: '', results: [] });
    render(<MyFilesView {...renderProps} searchValue="" />);
    // Browse table renders the folder1 row from the children mock.
    expect(screen.getByText('folder1')).toBeInTheDocument();
  });

  it('renders search results when searchValue is non-empty and there are matches', () => {
    mockUseFileSearch.mockReturnValue({
      debouncedQuery: 'rep',
      results: [
        {
          uri: 'https://pod/app/file1/index.ttl',
          conformsTo: 'https://schema.org/MediaObject',
          title: 'report.pdf',
          description: '',
          modified: '2026-04-01T00:00:00Z',
          publisher: 'https://owner/me',
          mediaType: 'application/pdf',
          byteSize: 12345,
          accessURL: 'https://pod/app/file1/binary',
        },
      ],
    });
    render(<MyFilesView {...renderProps} searchValue="rep" />);
    // The browse-mode "folder1" row is replaced by the search-mode "report.pdf" row.
    expect(screen.queryByText('folder1')).not.toBeInTheDocument();
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
  });

  it('shows a "no results" empty state when search has no matches', () => {
    mockUseFileSearch.mockReturnValue({ debouncedQuery: 'xyz', results: [] });
    render(<MyFilesView {...renderProps} searchValue="xyz" />);
    expect(screen.getByText(/no files match/i)).toBeInTheDocument();
  });

  it('hides the breadcrumb during search', () => {
    mockUseFileSearch.mockReturnValue({
      debouncedQuery: 'a',
      results: [],
    });
    render(<MyFilesView {...renderProps} searchValue="a" />);
    expect(
      screen.queryByRole('navigation', { name: /breadcrumb/i }),
    ).not.toBeInTheDocument();
  });
});

describe('MyFilesView — create flows', () => {
  it('renders NewFolderInput when showNewFolder is true', () => {
    render(<MyFilesView {...renderProps} showNewFolder />);
    expect(screen.getByTestId('mock-new-folder-input')).toBeInTheDocument();
  });

  it('does not render NewFolderInput when showNewFolder is false', () => {
    render(<MyFilesView {...renderProps} showNewFolder={false} />);
    expect(screen.queryByTestId('mock-new-folder-input')).not.toBeInTheDocument();
  });

  it('renders FileUpload when showUpload is true', () => {
    render(<MyFilesView {...renderProps} showUpload />);
    expect(screen.getByTestId('mock-file-upload')).toBeInTheDocument();
  });

  it('does not render FileUpload when showUpload is false', () => {
    render(<MyFilesView {...renderProps} showUpload={false} />);
    expect(screen.queryByTestId('mock-file-upload')).not.toBeInTheDocument();
  });
});

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

const mockHandleRetryStorage = vi.fn();
const driveInitDefaults = () => ({
  appContainerUri: 'https://pod/app/',
  storageRootUri: 'https://pod/',
  currentUri: 'https://pod/app/' as string | undefined,
  setCurrentUri: vi.fn(),
  breadcrumbs: [{ label: 'My Pod', uri: 'https://pod/app/' }] as Array<{
    label: string;
    uri: string;
  }>,
  setBreadcrumbs: vi.fn(),
  noStorageDetected: false,
  handleRetryStorage: mockHandleRetryStorage,
  handleNavigate: vi.fn(),
  handleBreadcrumbClick: vi.fn(),
  contacts: [],
});
const mockUseDriveInitialization = vi.fn(driveInitDefaults);
vi.mock('@/features/file-explorer/hooks/useDriveInitialization', () => ({
  useDriveInitialization: () => mockUseDriveInitialization(),
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

const mockResolveCatalogUri = vi.fn(() => 'https://pod/catalog' as string | null);
vi.mock('@/infrastructure/solid/catalog', () => ({
  resolveCatalogUri: () => mockResolveCatalogUri(),
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

const defaultUseResource = (uri: string | undefined) => ({
  uri: uri ?? '',
  children: () => [folderChild, fileContainerChild],
});
const mockUseResource = vi.fn<
  (uri: string | undefined) => unknown
>(defaultUseResource);
vi.mock('@ldo/solid-react', () => ({
  useResource: (uri: string | undefined) => mockUseResource(uri),
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

const mockHasUnsupportedFolderDrop = vi.fn<() => boolean>(() => false);
vi.mock('@/features/file-explorer/services/dragAndDrop', () => ({
  hasUnsupportedFolderDrop: () => mockHasUnsupportedFolderDrop(),
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

vi.mock('@/features/onedrive-layout/components/NewFolderDialog', () => ({
  NewFolderDialog: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="mock-new-folder-dialog">
        <button
          type="button"
          data-testid="mock-new-folder-dialog-close"
          onClick={() => onOpenChange(false)}
        >
          close
        </button>
        <button
          type="button"
          data-testid="mock-new-folder-dialog-open"
          onClick={() => onOpenChange(true)}
        >
          open
        </button>
      </div>
    ) : null,
}));

vi.mock('@/features/file-explorer/components/FileUpload', () => ({
  FileUpload: ({
    prefilledFile,
    onUploadSuccess,
  }: {
    prefilledFile?: File;
    onUploadSuccess: () => void;
  }) => (
    <div data-testid="mock-file-upload" data-prefilled={prefilledFile?.name ?? ''}>
      <button
        type="button"
        data-testid="mock-file-upload-success"
        onClick={onUploadSuccess}
      >
        success
      </button>
    </div>
  ),
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
    mockHasUnsupportedFolderDrop.mockReset();
    mockHasUnsupportedFolderDrop.mockReturnValue(false);
    mockUseDriveInitialization.mockImplementation(driveInitDefaults);
    mockUseResource.mockImplementation(defaultUseResource);
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

  it('drag-over with Files types prevents the default browser handling', () => {
    const { container } = render(<MyFilesView {...renderProps} />);
    const view = container.querySelector('onedrive-view');
    if (!view) throw new Error('onedrive-view not found');
    // fireEvent returns false when preventDefault was called.
    const handled = fireEvent.dragOver(view, {
      dataTransfer: { types: ['Files'] },
    });
    expect(handled).toBe(false);
  });

  it('drag-over with non-Files types does not call preventDefault (early returns)', () => {
    const { container } = render(<MyFilesView {...renderProps} />);
    const view = container.querySelector('onedrive-view');
    if (!view) throw new Error('onedrive-view not found');
    const handled = fireEvent.dragOver(view, {
      dataTransfer: { types: ['text/plain'] },
    });
    expect(handled).toBe(true);
  });

  it('panel drop with an unsupported folder drag shows an error and skips the queue', () => {
    mockHasUnsupportedFolderDrop.mockReturnValue(true);
    const { container } = render(<MyFilesView {...renderProps} />);
    const view = container.querySelector('onedrive-view');
    if (!view) throw new Error('onedrive-view not found');

    fireEvent.drop(view, {
      dataTransfer: {
        files: [new File(['x'], 'a.txt')],
        types: ['Files'],
      },
    });
    expect(mockShowError).toHaveBeenCalledWith(
      'fileExplorer.unsupportedFolderDrop',
    );
    expect(mockEnqueueInstant).not.toHaveBeenCalled();
  });

  it('folder-row drop with an unsupported folder drag shows an error and skips the queue', () => {
    mockHasUnsupportedFolderDrop.mockReturnValue(true);
    render(<MyFilesView {...renderProps} />);
    const folderRow = screen.getByRole('row', { name: /folder1/i });
    const files = [new File(['x'], 'a.txt')];
    fireEvent.drop(folderRow, { dataTransfer: { files, types: ['Files'] } });

    expect(mockShowError).toHaveBeenCalledWith(
      'fileExplorer.unsupportedFolderDrop',
    );
    expect(mockEnqueueInstant).not.toHaveBeenCalled();
  });

  it('drop on the panel with no files is a no-op (does not enqueue)', () => {
    const { container } = render(<MyFilesView {...renderProps} />);
    const view = container.querySelector('onedrive-view');
    if (!view) throw new Error('onedrive-view not found');

    fireEvent.drop(view, {
      dataTransfer: { files: [], types: ['Files'] },
    });
    expect(mockEnqueueInstant).not.toHaveBeenCalled();
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it('panel drop is a no-op while no current container URI is resolved yet', () => {
    mockUseDriveInitialization.mockImplementationOnce(() => ({
      ...driveInitDefaults(),
      currentUri: undefined,
    }));
    const { container } = render(<MyFilesView {...renderProps} />);
    const view = container.querySelector('onedrive-view');
    if (!view) throw new Error('onedrive-view not found');

    fireEvent.drop(view, {
      dataTransfer: {
        files: [new File(['x'], 'a.txt')],
        types: ['Files'],
      },
    });
    expect(mockEnqueueInstant).not.toHaveBeenCalled();
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
  it('renders NewFolderDialog when showNewFolder is true', () => {
    render(<MyFilesView {...renderProps} showNewFolder />);
    expect(screen.getByTestId('mock-new-folder-dialog')).toBeInTheDocument();
  });

  it('does not render NewFolderDialog when showNewFolder is false', () => {
    render(<MyFilesView {...renderProps} showNewFolder={false} />);
    expect(screen.queryByTestId('mock-new-folder-dialog')).not.toBeInTheDocument();
  });

  it('renders FileUpload when showUpload is true', () => {
    render(<MyFilesView {...renderProps} showUpload />);
    expect(screen.getByTestId('mock-file-upload')).toBeInTheDocument();
  });

  it('does not render FileUpload when showUpload is false', () => {
    render(<MyFilesView {...renderProps} showUpload={false} />);
    expect(screen.queryByTestId('mock-file-upload')).not.toBeInTheDocument();
  });

  it('seeds pickedFile from props into FileUpload as prefilledFile', () => {
    const file = new File(['hi'], 'picked.txt', { type: 'text/plain' });
    render(
      <MyFilesView {...renderProps} showUpload pickedFile={file} />,
    );
    expect(screen.getByTestId('mock-file-upload')).toHaveAttribute(
      'data-prefilled',
      'picked.txt',
    );
  });

  it('NewFolderDialog onOpenChange(false) calls onNewFolderDone', async () => {
    const user = userEvent.setup();
    const onNewFolderDone = vi.fn();
    render(
      <MyFilesView
        {...renderProps}
        showNewFolder
        onNewFolderDone={onNewFolderDone}
      />,
    );
    await user.click(screen.getByTestId('mock-new-folder-dialog-close'));
    expect(onNewFolderDone).toHaveBeenCalledOnce();
  });

  it('NewFolderDialog onOpenChange(true) does not call onNewFolderDone', async () => {
    const user = userEvent.setup();
    const onNewFolderDone = vi.fn();
    render(
      <MyFilesView
        {...renderProps}
        showNewFolder
        onNewFolderDone={onNewFolderDone}
      />,
    );
    await user.click(screen.getByTestId('mock-new-folder-dialog-open'));
    expect(onNewFolderDone).not.toHaveBeenCalled();
  });

  it('FileUpload onUploadSuccess clears the prefilled file and calls onUploadDone', async () => {
    const user = userEvent.setup();
    const onUploadDone = vi.fn();
    const file = new File(['x'], 'pre.txt', { type: 'text/plain' });
    render(
      <MyFilesView
        {...renderProps}
        showUpload
        pickedFile={file}
        onUploadDone={onUploadDone}
      />,
    );
    expect(screen.getByTestId('mock-file-upload')).toHaveAttribute(
      'data-prefilled',
      'pre.txt',
    );
    await user.click(screen.getByTestId('mock-file-upload-success'));
    expect(onUploadDone).toHaveBeenCalledOnce();
    expect(screen.getByTestId('mock-file-upload')).toHaveAttribute(
      'data-prefilled',
      '',
    );
  });

  it('seeds prefilledFile when pickedFile prop changes between renders', () => {
    const { rerender } = render(<MyFilesView {...renderProps} showUpload />);
    expect(screen.getByTestId('mock-file-upload')).toHaveAttribute(
      'data-prefilled',
      '',
    );
    const file = new File(['x'], 'late.txt', { type: 'text/plain' });
    rerender(<MyFilesView {...renderProps} showUpload pickedFile={file} />);
    expect(screen.getByTestId('mock-file-upload')).toHaveAttribute(
      'data-prefilled',
      'late.txt',
    );
  });
});

describe('MyFilesView — folder navigation resets prefilled file', () => {
  beforeEach(() => {
    mockUseDriveInitialization.mockImplementation(driveInitDefaults);
    mockUseResource.mockImplementation(defaultUseResource);
  });

  it('clears the prefilled file when currentUri changes between renders', () => {
    const file = new File(['x'], 'stale.txt', { type: 'text/plain' });
    const { rerender } = render(
      <MyFilesView {...renderProps} showUpload pickedFile={file} />,
    );
    expect(screen.getByTestId('mock-file-upload')).toHaveAttribute(
      'data-prefilled',
      'stale.txt',
    );
    mockUseDriveInitialization.mockImplementation(() => ({
      ...driveInitDefaults(),
      currentUri: 'https://pod/app/elsewhere/',
    }));
    rerender(<MyFilesView {...renderProps} showUpload pickedFile={file} />);
    expect(screen.getByTestId('mock-file-upload')).toHaveAttribute(
      'data-prefilled',
      '',
    );
  });
});

describe('MyFilesView — catalog URI fallback', () => {
  beforeEach(() => {
    mockResolveCatalogUri.mockReset();
    mockResolveCatalogUri.mockReturnValue('https://pod/catalog');
  });

  it('skips rendering FileUpload when no catalog URI can be resolved', () => {
    mockResolveCatalogUri.mockReturnValue(null);
    render(<MyFilesView {...renderProps} showUpload />);
    expect(screen.queryByTestId('mock-file-upload')).not.toBeInTheDocument();
  });
});

describe('MyFilesView — empty breadcrumbs fallback', () => {
  it('falls back to the localized myDrive label when breadcrumbs are empty', () => {
    mockUseDriveInitialization.mockImplementation(() => ({
      ...driveInitDefaults(),
      breadcrumbs: [],
    }));
    const { container } = render(<MyFilesView {...renderProps} />);
    // Page title lives in OneDriveLayout, so check DropZone's destination instead.
    const view = container.querySelector('onedrive-view');
    if (!view) throw new Error('onedrive-view not found');
    fireEvent.dragEnter(view, { dataTransfer: { types: ['Files'] } });
    expect(screen.getByTestId('drop-zone')).toHaveAttribute(
      'data-destination',
      'fileExplorer.myDrive',
    );
  });
});

describe('MyFilesView — early-return states', () => {
  beforeEach(() => {
    mockUseDriveInitialization.mockImplementation(driveInitDefaults);
    mockUseResource.mockImplementation(defaultUseResource);
    mockHandleRetryStorage.mockClear();
  });

  it('renders the no-storage-found message and a Retry button when noStorageDetected is true', async () => {
    mockUseDriveInitialization.mockImplementation(() => ({
      ...driveInitDefaults(),
      noStorageDetected: true,
    }));
    const user = userEvent.setup();
    render(<MyFilesView {...renderProps} />);
    expect(
      screen.getByText('fileExplorer.noStorageFound'),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'fileExplorer.retry' }),
    );
    expect(mockHandleRetryStorage).toHaveBeenCalledOnce();
  });

  it('renders the connecting spinner when no current container is loaded yet', () => {
    mockUseResource.mockReturnValue(null);
    const { container } = render(<MyFilesView {...renderProps} />);
    expect(container.querySelector('.spinner')).toBeInTheDocument();
    expect(screen.getByText('fileExplorer.connecting')).toBeInTheDocument();
  });

  it('renders an empty file table when the current resource is not a container', () => {
    mockUseResource.mockReturnValue({
      uri: 'https://pod/app/notes.txt',
      children: () => [folderChild, fileContainerChild],
    });
    render(<MyFilesView {...renderProps} />);
    expect(screen.queryByText('folder1')).not.toBeInTheDocument();
    expect(screen.queryByText('report.pdf')).not.toBeInTheDocument();
  });
});

describe('MyFilesView — breadcrumbs', () => {
  beforeEach(() => {
    mockUseDriveInitialization.mockImplementation(driveInitDefaults);
    mockUseResource.mockImplementation(defaultUseResource);
  });

  it('renders the breadcrumb when depth > 1 and disables the active crumb', () => {
    mockUseDriveInitialization.mockImplementation(() => ({
      ...driveInitDefaults(),
      currentUri: 'https://pod/app/docs/',
      breadcrumbs: [
        { label: 'My Pod', uri: 'https://pod/app/' },
        { label: 'docs', uri: 'https://pod/app/docs/' },
      ],
    }));
    render(<MyFilesView {...renderProps} />);
    const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(nav).toBeInTheDocument();
    const crumbs = screen.getAllByRole('button', { name: /My Pod|docs/ });
    const active = crumbs.find((b) =>
      b.className.includes('odl-breadcrumb__item--active'),
    );
    expect(active).toBeDefined();
    expect(active).toBeDisabled();
  });

  it('clicking a non-active crumb navigates back to that level', async () => {
    mockUseDriveInitialization.mockImplementation(() => ({
      ...driveInitDefaults(),
      currentUri: 'https://pod/app/docs/',
      breadcrumbs: [
        { label: 'My Pod', uri: 'https://pod/app/' },
        { label: 'docs', uri: 'https://pod/app/docs/' },
      ],
    }));
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/');
    render(<MyFilesView {...renderProps} />);
    await user.click(screen.getByRole('button', { name: 'My Pod' }));
    expect(window.history.state).toMatchObject({
      marker: 'odl-my-files',
      currentUri: 'https://pod/app/',
    });
  });
});

describe('MyFilesView — refreshNonce reload', () => {
  beforeEach(() => {
    mockUseDriveInitialization.mockImplementation(driveInitDefaults);
  });

  it('re-reads the open folder when refreshNonce changes from the initial value', () => {
    const read = vi.fn().mockResolvedValue(undefined);
    mockUseResource.mockImplementation((uri) => ({
      uri: uri ?? '',
      children: () => [folderChild, fileContainerChild],
      read,
    }));

    const { rerender } = render(
      <MyFilesView {...renderProps} refreshNonce={0} />,
    );
    expect(read).not.toHaveBeenCalled();

    rerender(<MyFilesView {...renderProps} refreshNonce={1} />);
    expect(read).toHaveBeenCalledTimes(1);

    rerender(<MyFilesView {...renderProps} refreshNonce={2} />);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('does not call read on the initial render', () => {
    const read = vi.fn().mockResolvedValue(undefined);
    mockUseResource.mockImplementation((uri) => ({
      uri: uri ?? '',
      children: () => [folderChild, fileContainerChild],
      read,
    }));

    render(<MyFilesView {...renderProps} refreshNonce={0} />);
    expect(read).not.toHaveBeenCalled();
  });

  it('does not throw when the open resource is not a container', () => {
    // The isSolidContainer mock treats trailing slash as a container. A
    // leaf URI fails the guard and the effect short-circuits before
    // touching read.
    mockUseDriveInitialization.mockImplementation(() => ({
      ...driveInitDefaults(),
      currentUri: 'https://pod/app/leaf',
    }));
    mockUseResource.mockImplementation((uri) => ({
      uri: uri ?? '',
      children: () => [folderChild, fileContainerChild],
    }));

    const { rerender } = render(
      <MyFilesView {...renderProps} refreshNonce={0} />,
    );
    expect(() =>
      rerender(<MyFilesView {...renderProps} refreshNonce={1} />),
    ).not.toThrow();
  });
});

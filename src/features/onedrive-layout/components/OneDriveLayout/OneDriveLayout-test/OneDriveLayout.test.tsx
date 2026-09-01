import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OneDriveLayout } from '../OneDriveLayout-file/OneDriveLayout';

vi.mock('@/features/onedrive-layout/components/NavRail', () => ({
  NavRail: ({
    onFilesPicked,
    onNewFolder,
  }: {
    onNewFolder: () => void;
    onFilesPicked: (files: File[]) => void;
  }) => (
    <nav-rail data-testid="nav-rail">
      <button
        type="button"
        data-testid="nav-pick-files"
        onClick={() =>
          onFilesPicked?.([new File(['x'], 'pick.txt', { type: 'text/plain' })])
        }
      >
        pick
      </button>
      <button
        type="button"
        data-testid="nav-new-folder"
        onClick={() => onNewFolder?.()}
      >
        new folder
      </button>
      <button
        type="button"
        data-testid="nav-rail-new-folder"
        onClick={() => onNewFolder?.()}
      >
        new folder
      </button>
      <button
        type="button"
        data-testid="nav-rail-upload"
        onClick={() =>
          onFilesPicked?.([new File(['x'], 'pick.txt', { type: 'text/plain' })])
        }
      >
        upload
      </button>
    </nav-rail>
  ),
}));

vi.mock('@/features/onedrive-layout/components/TopBar', () => ({
  TopBar: ({ searchValue }: { searchValue: string }) => (
    <top-bar data-testid="top-bar" data-search={searchValue} />
  ),
}));

interface MockMyFilesViewProps {
  showUpload: boolean;
  showNewFolder: boolean;
  pickedFile?: File;
  selectedUri?: string;
  refreshNonce?: number;
  onUploadDone: () => void;
  onRequestUpload: () => void;
  onNewFolderDone: () => void;
  onSelect: (next: { kind: 'file'; uri: string; name: string }) => void;
}

const mockMyFilesViewProps = vi.fn<(props: MockMyFilesViewProps) => void>();
vi.mock('@/features/onedrive-layout/components/views/MyFilesView', () => ({
  MyFilesView: (props: MockMyFilesViewProps) => {
    mockMyFilesViewProps(props);
    return (
      <div
        data-testid="view-my-files"
        data-show-new-folder={String(props.showNewFolder)}
        data-show-upload={String(props.showUpload)}
      >
        <button type="button" data-testid="upload-done" onClick={() => props.onUploadDone()}>
          done
        </button>
        <button type="button" data-testid="request-upload" onClick={() => props.onRequestUpload()}>
          request upload
        </button>
        <button type="button" data-testid="new-folder-done" onClick={() => props.onNewFolderDone()}>
          folder done
        </button>
        <button
          type="button"
          data-testid="view-my-files-new-folder-done"
          onClick={() => props.onNewFolderDone()}
        >
          new-folder-done
        </button>
        <button
          type="button"
          data-testid="view-my-files-upload-done"
          onClick={() => props.onUploadDone()}
        >
          upload-done
        </button>
        <button
          type="button"
          data-testid="view-my-files-request-upload"
          onClick={() => props.onRequestUpload()}
        >
          request-upload
        </button>
        <button
          type="button"
          data-testid="select-row"
          onClick={() =>
            props.onSelect({
              kind: 'file',
              uri: 'https://pod/app/x.txt',
              name: 'x.txt',
            })
          }
        >
          select
        </button>
      </div>
    );
  },
}));

interface MockContextualToolbarProps {
  detailsOpen: boolean;
  onToggleDetails: () => void;
}
const mockContextualToolbarProps = vi.fn<(props: MockContextualToolbarProps) => void>();
vi.mock('@/features/onedrive-layout/components/ContextualToolbar', () => ({
  ContextualToolbar: (props: MockContextualToolbarProps) => {
    mockContextualToolbarProps(props);
    return (
      <div data-testid="contextual-toolbar">
        <button type="button" data-testid="toggle-details" onClick={props.onToggleDetails}>
          details
        </button>
      </div>
    );
  },
}));

interface MockDetailPanelProps {
  open: boolean;
  onClose: () => void;
}
const mockDetailPanelProps = vi.fn<(props: MockDetailPanelProps) => void>();
vi.mock('@/features/onedrive-layout/components/DetailPanel', () => ({
  DetailPanel: (props: MockDetailPanelProps) => {
    mockDetailPanelProps(props);
    return (
      <div data-testid="detail-panel" data-open={String(props.open)}>
        <div data-testid="mock-detail-panel" data-open={String(props.open)} />
        <button
          type="button"
          data-testid="close-details"
          aria-label="panel-close"
          onClick={props.onClose}
        >
          close
        </button>
      </div>
    );
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string, fallback?: string) => fallback ?? key],
}));

const mockProfileSubject: { current: Record<string, unknown> | null } = { current: null };
const mockSession: {
  current: { webId: string | undefined; isActive: boolean };
} = { current: { webId: 'https://owner/me', isActive: true } };
vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ session: mockSession.current, fetch: vi.fn() }),
  useSubject: () => mockProfileSubject.current,
  useResource: () => null,
  useLdo: () => ({ dataset: { match: () => [] } }),
}));

const mockDeleteResource = vi.fn().mockResolvedValue({ ok: true });
vi.mock('@/features/file-explorer/services/deleteResource', () => ({
  deleteResource: (...args: unknown[]) => mockDeleteResource(...args),
}));

const mockSoftDeleteFile = vi.fn().mockResolvedValue({ ok: true, trashItemContainerUri: 'https://pod/trash/doc/' });
vi.mock('@/features/file-explorer/services/softDeleteFile', () => ({
  softDeleteFile: (...args: unknown[]) => mockSoftDeleteFile(...args),
}));

const mockSoftDeleteFolder = vi.fn().mockResolvedValue({ ok: true, trashItemContainerUri: 'https://pod/trash/folder/' });
vi.mock('@/features/file-explorer/services/softDeleteFolder', () => ({
  softDeleteFolder: (...args: unknown[]) => mockSoftDeleteFolder(...args),
}));

vi.mock('@/features/file-explorer/hooks/useDriveInitialization', () => ({
  useDriveInitialization: () => ({
    storageRootUri: 'https://pod/',
    appContainerUri: 'https://pod/app/',
    currentUri: 'https://pod/app/',
    setCurrentUri: vi.fn(),
    breadcrumbs: [],
    setBreadcrumbs: vi.fn(),
    noStorageDetected: false,
    handleRetryStorage: vi.fn(),
    handleNavigate: vi.fn(),
    handleBreadcrumbClick: vi.fn(),
  }),
}));

vi.mock('@/features/file-explorer/hooks/useContacts', () => ({
  useContacts: () => [],
}));

const sampleCatalogEntry = {
  uri: 'https://pod/app/doc/index.ttl',
  conformsTo: 'https://schema.org/MediaObject',
  title: 'doc.pdf',
  description: 'a sample document',
  modified: '2026-04-01T00:00:00Z',
  publisher: 'https://owner/me',
  mediaType: 'application/pdf',
  byteSize: 1024,
  accessURL: 'https://pod/app/doc/binary',
};

vi.mock('@/features/file-explorer/hooks/useCatalog', () => ({
  useCatalog: () => ({
    entries: [sampleCatalogEntry],
    containerUris: new Set(['https://pod/app/doc/']),
    loading: false,
    error: null,
  }),
}));

vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isDeletable: () => false,
  isSolidContainer: () => true,
  isLoadable: () => false,
  isReadable: () => false,
  isReloadable: () => false,
}));

vi.mock('@/infrastructure/solid/catalog', () => ({
  resolveCatalogUri: () => 'https://pod/catalog',
  removeFromCatalog: vi.fn().mockResolvedValue(undefined),
}));

const mockClear = vi.fn();
const mockSelect = vi.fn();
type MockSelection = { kind: 'file' | 'folder'; uri: string; name: string };
const mockSelected: { current: MockSelection | null } = { current: null };
// The mock keeps real local state so selecting a row and clearing the
// selection both trigger a re-render, mirroring the real hook. Tests seed
// the initial selection by assigning to mockSelected.current before render.
vi.mock('@/features/onedrive-layout/hooks/useSelectedResource', async () => {
  const { useState } = await import('react');
  return {
    useSelectedResource: () => {
      const [selected, setSelected] = useState<MockSelection | null>(
        mockSelected.current,
      );
      return {
        selected,
        select: (next: MockSelection) => {
          mockSelect(next);
          setSelected(next);
        },
        clear: () => {
          mockClear();
          setSelected(null);
        },
      };
    },
  };
});

const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
const mockConfirm = vi.fn().mockResolvedValue(true);
vi.mock('@/shared/contexts/NotificationContext', () => ({
  useNotifications: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    confirm: mockConfirm,
  }),
}));

const mockCopyToClipboard = vi.fn().mockResolvedValue(true);
vi.mock('@/shared/utils/copyToClipboard', () => ({
  copyToClipboard: (text: string) => mockCopyToClipboard(text),
}));

const mockDownloadResource = vi.fn().mockResolvedValue({ ok: true });
vi.mock('@/features/file-explorer/services/downloadResource', () => ({
  downloadResource: (...args: unknown[]) => mockDownloadResource(...args),
}));

vi.mock('@/features/onedrive-layout/components/ShareDialog', () => ({
  ShareDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="mock-share-dialog" /> : null,
}));

describe('OneDriveLayout', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    mockMyFilesViewProps.mockClear();
    mockContextualToolbarProps.mockClear();
    mockDetailPanelProps.mockClear();
  });

  it('renders the rail and the top bar', () => {
    render(<OneDriveLayout />);
    expect(screen.getByTestId('nav-rail')).toBeInTheDocument();
    expect(screen.getByTestId('top-bar')).toBeInTheDocument();
  });

  it('renders the onedrive-layout root element', () => {
    const { container } = render(<OneDriveLayout />);
    expect(container.querySelector('onedrive-layout')).toBeInTheDocument();
  });

  it('defaults to the recent (Home) view', () => {
    const { container } = render(<OneDriveLayout />);
    expect(
      container.querySelector('onedrive-view[data-view-id="recent"]'),
    ).not.toBeNull();
  });

  it.each([
    ['my-files', 'view-my-files'],
    ['requests', 'requests'],
    ['people', 'people'],
  ])('renders the right view when ?view=%s', (param, viewId) => {
    window.history.replaceState({}, '', `/?view=${param}`);
    const { container } = render(<OneDriveLayout />);
    // The My Files view still uses a testid because the test mocks it;
    // the other views render their real implementation and surface
    // their identity via `data-view-id` on their <onedrive-view> root.
    if (viewId === 'view-my-files') {
      expect(screen.getByTestId(viewId)).toBeInTheDocument();
    } else {
      expect(
        container.querySelector(`onedrive-view[data-view-id="${viewId}"]`),
      ).not.toBeNull();
    }
  });

  it('renders Shared\'s own toolbar and body instead of the page header when ?view=shared', () => {
    window.history.replaceState({}, '', '/?view=shared');
    const { container } = render(<OneDriveLayout />);
    expect(container.querySelector('shared-toolbar')).not.toBeNull();
    expect(container.querySelector('shared-body')).not.toBeNull();
    expect(container.querySelector('page-header')).toBeNull();
  });

  it('keeps the topbar mounted on the shared view (search stays global)', () => {
    window.history.replaceState({}, '', '/?view=shared');
    render(<OneDriveLayout />);
    expect(screen.getByTestId('top-bar')).toBeInTheDocument();
  });

  it('falls back to the recent view on an unknown ?view= value', () => {
    window.history.replaceState({}, '', '/?view=banana');
    const { container } = render(<OneDriveLayout />);
    expect(
      container.querySelector('onedrive-view[data-view-id="recent"]'),
    ).not.toBeNull();
  });

  it('picking files from the rail switches to My Files and opens the upload form pre-filled with them', () => {
    render(<OneDriveLayout />);

    act(() => {
      screen.getByTestId('nav-pick-files').click();
    });

    expect(screen.getByTestId('view-my-files')).toBeInTheDocument();
    const lastProps =
      mockMyFilesViewProps.mock.calls[
        mockMyFilesViewProps.mock.calls.length - 1
      ][0];
    expect(lastProps.showUpload).toBe(true);
    expect(lastProps.pickedFile).toBeInstanceOf(File);
    expect(lastProps.pickedFile?.name).toBe('pick.txt');
  });

  it('clicking New Folder in the rail switches to My Files and opens the new-folder form', () => {
    render(<OneDriveLayout />);

    act(() => {
      screen.getByTestId('nav-new-folder').click();
    });

    expect(screen.getByTestId('view-my-files')).toBeInTheDocument();
    const lastProps =
      mockMyFilesViewProps.mock.calls[
        mockMyFilesViewProps.mock.calls.length - 1
      ][0];
    expect(lastProps.showNewFolder).toBe(true);
  });

  it('finishing an upload closes the upload form and clears the picked file', () => {
    render(<OneDriveLayout />);
    act(() => {
      screen.getByTestId('nav-pick-files').click();
    });
    act(() => {
      screen.getByTestId('upload-done').click();
    });

    const lastProps =
      mockMyFilesViewProps.mock.calls[
        mockMyFilesViewProps.mock.calls.length - 1
      ][0];
    expect(lastProps.showUpload).toBe(false);
    expect(lastProps.pickedFile).toBeUndefined();
  });

  it('toggling details from the contextual toolbar flips the panel open state', () => {
    window.history.replaceState({}, '', '/?view=my-files');
    render(<OneDriveLayout />);
    expect(screen.getByTestId('detail-panel')).toHaveAttribute(
      'data-open',
      'false',
    );
    act(() => {
      screen.getByTestId('toggle-details').click();
    });
    expect(screen.getByTestId('detail-panel')).toHaveAttribute(
      'data-open',
      'true',
    );
    act(() => {
      screen.getByTestId('toggle-details').click();
    });
    expect(screen.getByTestId('detail-panel')).toHaveAttribute(
      'data-open',
      'false',
    );
  });

  it('close button on the detail panel collapses it', () => {
    window.history.replaceState({}, '', '/?view=my-files');
    render(<OneDriveLayout />);
    act(() => {
      screen.getByTestId('toggle-details').click();
    });
    expect(screen.getByTestId('detail-panel')).toHaveAttribute(
      'data-open',
      'true',
    );
    act(() => {
      screen.getByTestId('close-details').click();
    });
    expect(screen.getByTestId('detail-panel')).toHaveAttribute(
      'data-open',
      'false',
    );
  });

  it('opens the upload form when My Files asks the layout to open it', () => {
    window.history.replaceState({}, '', '/?view=my-files');
    render(<OneDriveLayout />);
    act(() => {
      screen.getByTestId('request-upload').click();
    });
    const lastProps =
      mockMyFilesViewProps.mock.calls[
        mockMyFilesViewProps.mock.calls.length - 1
      ][0];
    expect(lastProps.showUpload).toBe(true);
  });

  it('closes the new-folder form once My Files reports it\'s finished', () => {
    render(<OneDriveLayout />);
    act(() => {
      screen.getByTestId('nav-new-folder').click();
    });
    expect(
      mockMyFilesViewProps.mock.calls[
        mockMyFilesViewProps.mock.calls.length - 1
      ][0].showNewFolder,
    ).toBe(true);
    act(() => {
      screen.getByTestId('new-folder-done').click();
    });
    expect(
      mockMyFilesViewProps.mock.calls[
        mockMyFilesViewProps.mock.calls.length - 1
      ][0].showNewFolder,
    ).toBe(false);
  });

  it('selecting a row in My Files marks that file as the current selection', () => {
    window.history.replaceState({}, '', '/?view=my-files');
    render(<OneDriveLayout />);
    act(() => {
      screen.getByTestId('select-row').click();
    });
    expect(
      mockMyFilesViewProps.mock.calls[
        mockMyFilesViewProps.mock.calls.length - 1
      ][0].selectedUri,
    ).toBe('https://pod/app/x.txt');
  });
});

describe('OneDriveLayout — selection actions', () => {
  beforeEach(() => {
    mockSelected.current = null;
    mockClear.mockClear();
    mockCopyToClipboard.mockClear();
  });

  it('renders no action buttons when nothing is selected', () => {
    mockSelected.current = null;
    window.history.replaceState({}, '', '/?view=my-files');
    render(<OneDriveLayout />);
    expect(
      screen.queryByRole('button', { name: /share/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /copy link/i }),
    ).not.toBeInTheDocument();
  });

  it('renders the 6 action buttons when a file is selected', () => {
    mockSelected.current = {
      kind: 'file',
      uri: 'https://pod/app/doc/',
      name: 'doc.pdf',
    };
    window.history.replaceState({}, '', '/?view=my-files');
    render(<OneDriveLayout />);
    for (const label of ['share', 'copy link', 'download', 'rename']) {
      expect(
        screen.getByRole('button', { name: new RegExp(label, 'i') }),
      ).toBeInTheDocument();
    }
    // "Move to bin" and "Move to" (stub) collide under substring/regex
    // matching, so these use exact accessible names.
    expect(screen.getByRole('button', { name: 'Move to bin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move to' })).toBeInTheDocument();
  });

  it('copies the selected file\'s URI to the clipboard when Copy link is clicked', async () => {
    const user = userEvent.setup();
    mockSelected.current = {
      kind: 'file',
      uri: 'https://pod/app/doc/',
      name: 'doc.pdf',
    };
    window.history.replaceState({}, '', '/?view=my-files');
    render(<OneDriveLayout />);
    await user.click(screen.getByRole('button', { name: /copy link/i }));
    expect(mockCopyToClipboard).toHaveBeenCalledWith('https://pod/app/doc/');
  });

  it('opens the ShareDialog when Share is clicked', async () => {
    const user = userEvent.setup();
    mockSelected.current = {
      kind: 'file',
      uri: 'https://pod/app/doc/',
      name: 'doc.pdf',
    };
    window.history.replaceState({}, '', '/?view=my-files');
    render(<OneDriveLayout />);
    expect(screen.queryByTestId('mock-share-dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /share/i }));
    expect(screen.getByTestId('mock-share-dialog')).toBeInTheDocument();
  });

  it('closing the details panel clears the selection', async () => {
    const user = userEvent.setup();
    mockSelected.current = {
      kind: 'file',
      uri: 'https://pod/app/doc/',
      name: 'doc.pdf',
    };
    window.history.replaceState({}, '', '/?view=my-files');
    render(<OneDriveLayout />);
    await user.click(screen.getByRole('button', { name: /details/i }));
    await user.click(screen.getByRole('button', { name: /panel-close/i }));
    expect(mockClear).toHaveBeenCalled();
  });
});

describe('OneDriveLayout — handler outcomes', () => {
  beforeEach(() => {
    mockSelected.current = {
      kind: 'file',
      uri: 'https://pod/app/doc/',
      name: 'doc.pdf',
    };
    mockShowSuccess.mockClear();
    mockShowError.mockClear();
    mockConfirm.mockReset().mockResolvedValue(true);
    mockCopyToClipboard.mockClear().mockResolvedValue(true);
    mockDownloadResource.mockClear().mockResolvedValue({ ok: true });
    mockDeleteResource.mockClear().mockResolvedValue({ ok: true });
    mockSoftDeleteFile.mockClear().mockResolvedValue({ ok: true, trashItemContainerUri: 'https://pod/trash/doc/' });
    mockSoftDeleteFolder.mockClear().mockResolvedValue({ ok: true, trashItemContainerUri: 'https://pod/trash/folder/' });
    mockClear.mockClear();
    mockMyFilesViewProps.mockClear();
    window.history.replaceState({}, '', '/?view=my-files');
  });

  it('shows a success toast when Copy link succeeds', async () => {
    const user = userEvent.setup();
    render(<OneDriveLayout />);
    await user.click(screen.getByRole('button', { name: /copy link/i }));
    expect(mockShowSuccess).toHaveBeenCalled();
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it('shows an error toast when Copy link fails', async () => {
    mockCopyToClipboard.mockResolvedValueOnce(false);
    const user = userEvent.setup();
    render(<OneDriveLayout />);
    await user.click(screen.getByRole('button', { name: /copy link/i }));
    expect(mockShowError).toHaveBeenCalled();
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });

  it('downloads the selected file\'s binary resource, not its container, when Download is clicked', async () => {
    const user = userEvent.setup();
    render(<OneDriveLayout />);
    await user.click(screen.getByRole('button', { name: /download/i }));
    expect(mockDownloadResource).toHaveBeenCalledWith(
      sampleCatalogEntry.accessURL,
      expect.any(String),
      expect.any(Function),
    );
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it('shows an error toast when Download fails', async () => {
    mockDownloadResource.mockResolvedValueOnce({ ok: false, reason: 'network' });
    const user = userEvent.setup();
    render(<OneDriveLayout />);
    await user.click(screen.getByRole('button', { name: /download/i }));
    expect(mockShowError).toHaveBeenCalled();
  });

  it('does nothing when Download is clicked on a folder selection', async () => {
    mockSelected.current = {
      kind: 'folder',
      uri: 'https://pod/app/folder/',
      name: 'folder',
    };
    const user = userEvent.setup();
    render(<OneDriveLayout />);
    await user.click(screen.getByRole('button', { name: /download/i }));
    expect(mockDownloadResource).not.toHaveBeenCalled();
  });

  it('soft-deletes a file selection and clears the selection when Delete is confirmed', async () => {
    const user = userEvent.setup();
    render(<OneDriveLayout />);
    await user.click(screen.getByRole('button', { name: 'Move to bin' }));
    expect(mockConfirm).toHaveBeenCalled();
    expect(mockSoftDeleteFile).toHaveBeenCalledWith(
      expect.objectContaining({ containerUri: 'https://pod/app/doc/', storageRootUri: 'https://pod/' }),
    );
    expect(mockDeleteResource).not.toHaveBeenCalled();
    expect(mockShowSuccess).toHaveBeenCalled();
    expect(mockClear).toHaveBeenCalled();
  });

  it('soft-deletes a folder selection and clears the selection when Delete is confirmed', async () => {
    mockSelected.current = { kind: 'folder', uri: 'https://pod/app/folder/', name: 'folder' };
    const user = userEvent.setup();
    render(<OneDriveLayout />);
    await user.click(screen.getByRole('button', { name: 'Move to bin' }));
    expect(mockSoftDeleteFolder).toHaveBeenCalledWith(
      expect.objectContaining({ containerUri: 'https://pod/app/folder/', storageRootUri: 'https://pod/' }),
    );
    expect(mockDeleteResource).not.toHaveBeenCalled();
    expect(mockSoftDeleteFile).not.toHaveBeenCalled();
    expect(mockShowSuccess).toHaveBeenCalled();
    expect(mockClear).toHaveBeenCalled();
  });

  it('falls back to hard-deleting a folder, using its own URI as the catalog key, when no owner webId is resolved', async () => {
    mockSelected.current = { kind: 'folder', uri: 'https://pod/app/folder/', name: 'folder' };
    mockSession.current = { webId: undefined, isActive: true };
    const user = userEvent.setup();
    render(<OneDriveLayout />);
    await user.click(screen.getByRole('button', { name: 'Move to bin' }));
    expect(mockDeleteResource).toHaveBeenCalledWith(
      expect.objectContaining({ containerUri: 'https://pod/app/folder/', metadataUri: 'https://pod/app/folder/' }),
    );
    expect(mockSoftDeleteFolder).not.toHaveBeenCalled();
    mockSession.current = { webId: 'https://owner/me', isActive: true };
  });

  it('skips the delete when the user cancels the confirmation', async () => {
    mockConfirm.mockResolvedValueOnce(false);
    const user = userEvent.setup();
    render(<OneDriveLayout />);
    await user.click(screen.getByRole('button', { name: 'Move to bin' }));
    expect(mockSoftDeleteFile).not.toHaveBeenCalled();
    expect(mockDeleteResource).not.toHaveBeenCalled();
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });

  it('shows an error toast and keeps the selection when Delete fails', async () => {
    mockSoftDeleteFile.mockResolvedValueOnce({ ok: false, reason: '500' });
    const user = userEvent.setup();
    render(<OneDriveLayout />);
    await user.click(screen.getByRole('button', { name: 'Move to bin' }));
    expect(mockShowError).toHaveBeenCalled();
    expect(mockShowSuccess).not.toHaveBeenCalled();
    expect(mockClear).not.toHaveBeenCalled();
  });

  it('tells My Files to re-read the folder listing after a successful delete', async () => {
    const user = userEvent.setup();
    render(<OneDriveLayout />);
    const nonceBefore =
      mockMyFilesViewProps.mock.lastCall?.[0]?.refreshNonce ?? 0;
    await user.click(screen.getByRole('button', { name: 'Move to bin' }));
    const nonceAfter =
      mockMyFilesViewProps.mock.lastCall?.[0]?.refreshNonce ?? 0;
    expect(nonceAfter).toBeGreaterThan(nonceBefore);
  });

  it('does not tell My Files to re-read the listing when Delete fails', async () => {
    mockSoftDeleteFile.mockResolvedValueOnce({ ok: false, reason: '500' });
    const user = userEvent.setup();
    render(<OneDriveLayout />);
    const nonceBefore =
      mockMyFilesViewProps.mock.lastCall?.[0]?.refreshNonce ?? 0;
    await user.click(screen.getByRole('button', { name: 'Move to bin' }));
    const nonceAfter =
      mockMyFilesViewProps.mock.lastCall?.[0]?.refreshNonce ?? 0;
    expect(nonceAfter).toBe(nonceBefore);
  });

  it('Move To and Rename are present but inert (no notifications, no service calls)', async () => {
    const user = userEvent.setup();
    render(<OneDriveLayout />);
    // Exact name — "Move to" (stub) and "Move to bin" (soft-delete) collide under regex matching.
    await user.click(screen.getByRole('button', { name: 'Move to' }));
    await user.click(screen.getByRole('button', { name: /rename/i }));
    expect(mockShowSuccess).not.toHaveBeenCalled();
    expect(mockShowError).not.toHaveBeenCalled();
    expect(mockDeleteResource).not.toHaveBeenCalled();
    expect(mockSoftDeleteFile).not.toHaveBeenCalled();
    expect(mockDownloadResource).not.toHaveBeenCalled();
  });
});

describe('OneDriveLayout — NavRail integration', () => {
  beforeEach(() => {
    mockSelected.current = null;
    window.history.replaceState({}, '', '/');
  });

  it('clicking the rail "new folder" action switches to My Files and tells it to open the new-folder form', async () => {
    const user = userEvent.setup();
    render(<OneDriveLayout />);
    await user.click(screen.getByTestId('nav-rail-new-folder'));
    const view = await screen.findByTestId('view-my-files');
    expect(view).toHaveAttribute('data-show-new-folder', 'true');
  });

  it('clicking the rail upload action switches to My Files and tells it to open the upload form', async () => {
    const user = userEvent.setup();
    render(<OneDriveLayout />);
    await user.click(screen.getByTestId('nav-rail-upload'));
    const view = await screen.findByTestId('view-my-files');
    expect(view).toHaveAttribute('data-show-upload', 'true');
  });
});

describe('OneDriveLayout — MyFilesView callbacks', () => {
  beforeEach(() => {
    mockSelected.current = null;
    window.history.replaceState({}, '', '/?view=my-files');
  });

  it('closes the new-folder form once My Files reports the new folder is done', async () => {
    const user = userEvent.setup();
    render(<OneDriveLayout />);
    await user.click(screen.getByTestId('nav-rail-new-folder'));
    let view = await screen.findByTestId('view-my-files');
    expect(view).toHaveAttribute('data-show-new-folder', 'true');

    await user.click(screen.getByTestId('view-my-files-new-folder-done'));
    view = await screen.findByTestId('view-my-files');
    expect(view).toHaveAttribute('data-show-new-folder', 'false');
  });

  it('closes the upload form once My Files reports the upload is done', async () => {
    const user = userEvent.setup();
    render(<OneDriveLayout />);
    await user.click(screen.getByTestId('nav-rail-upload'));
    let view = await screen.findByTestId('view-my-files');
    expect(view).toHaveAttribute('data-show-upload', 'true');

    await user.click(screen.getByTestId('view-my-files-upload-done'));
    view = await screen.findByTestId('view-my-files');
    expect(view).toHaveAttribute('data-show-upload', 'false');
  });

  it('opens the upload form when MyFilesView requests an upload (e.g. drop on the panel)', async () => {
    const user = userEvent.setup();
    render(<OneDriveLayout />);
    await user.click(screen.getByTestId('view-my-files-request-upload'));
    const view = await screen.findByTestId('view-my-files');
    expect(view).toHaveAttribute('data-show-upload', 'true');
  });

  it('toggling the details button twice opens then closes the details panel', async () => {
    mockSelected.current = {
      kind: 'file',
      uri: 'https://pod/app/doc/',
      name: 'doc.pdf',
    };
    const user = userEvent.setup();
    render(<OneDriveLayout />);
    const detailsButton = screen.getByRole('button', { name: /details/i });
    const detailPanel = screen.getByTestId('mock-detail-panel');

    expect(detailPanel).toHaveAttribute('data-open', 'false');
    await user.click(detailsButton);
    expect(detailPanel).toHaveAttribute('data-open', 'true');
    await user.click(detailsButton);
    expect(detailPanel).toHaveAttribute('data-open', 'false');
  });
});

describe('OneDriveLayout — extra branch coverage', () => {
  beforeEach(() => {
    mockSelected.current = {
      kind: 'file',
      uri: 'https://pod/app/doc/',
      name: 'doc.pdf',
    };
    mockShowSuccess.mockClear();
    mockShowError.mockClear();
    mockDownloadResource.mockClear().mockResolvedValue({ ok: true });
    window.history.replaceState({}, '', '/?view=my-files');
  });

  it('falls back to the selected file\'s display name when its URI has no usable filename segment', async () => {
    // 'https://' strips to '' from split('/').pop() → fallback to name
    mockSelected.current = {
      kind: 'file',
      uri: 'https://',
      name: 'my-file.pdf',
    };
    const user = userEvent.setup();
    render(<OneDriveLayout />);
    await user.click(screen.getByRole('button', { name: /download/i }));
    expect(mockDownloadResource).toHaveBeenCalledWith(
      'https://',
      'my-file.pdf',
      expect.any(Function),
    );
  });

  it('does not render the ShareDialog before anything is selected', () => {
    // We cannot easily make resolveCatalogUri return null in isolation since
    // it's already mocked at module level. This test verifies the
    // conditional render guard (selected && catalogUri && sharedEntry) by
    // checking the dialog is absent when there is no selection.
    mockSelected.current = null;
    render(<OneDriveLayout />);
    expect(screen.queryByTestId('mock-share-dialog')).not.toBeInTheDocument();
  });

  it('falls back to an empty webId when the session has none yet', () => {
    mockSession.current = { webId: undefined, isActive: false };
    mockSelected.current = null;
    render(<OneDriveLayout />);
    // Render does not throw and the shell still mounts with no signed-in user.
    expect(screen.getByTestId('onedrive-layout-root')).toBeInTheDocument();
    mockSession.current = { webId: 'https://owner/me', isActive: true };
  });
});

describe('OneDriveLayout — view change clears the active selection', () => {
  beforeEach(() => {
    mockSelected.current = {
      kind: 'file',
      uri: 'https://pod/app/doc/',
      name: 'doc.pdf',
    };
    mockClear.mockClear();
  });

  it('clears the selection when the user navigates away from my-files via the URL', async () => {
    window.history.replaceState({}, '', '/?view=my-files');
    const { rerender } = render(<OneDriveLayout />);
    expect(mockClear).not.toHaveBeenCalled();

    window.history.replaceState({}, '', '/?view=shared');
    window.dispatchEvent(new PopStateEvent('popstate'));
    rerender(<OneDriveLayout />);
    expect(mockClear).toHaveBeenCalled();
  });
});

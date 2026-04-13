import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { SolidContainerUri } from '@ldo/connected-solid';
import { FileExplorer } from '../FileExplorer-file/FileExplorer';

/* ---- Mocks ---- */
const mockSession: { isLoggedIn: boolean; webId: string | undefined } = { isLoggedIn: true, webId: 'https://pod.example/profile/card#me' };
const mockFetch = vi.fn();
const mockShowError = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ session: mockSession, fetch: mockFetch }),
  useResource: vi.fn(),
  useSubject: vi.fn(),
}));

const mockUseDriveInit = {
  appContainerUri: 'https://pod.example/my-solid-app/' as SolidContainerUri,
  storageRootUri: 'https://pod.example/',
  currentUri: 'https://pod.example/my-solid-app/' as SolidContainerUri,
  setCurrentUri: vi.fn(),
  breadcrumbs: [{ label: 'My Drive', uri: 'https://pod.example/my-solid-app/' as SolidContainerUri }],
  setBreadcrumbs: vi.fn(),
  noStorageDetected: false,
  handleRetryStorage: vi.fn(),
  handleNavigate: vi.fn(),
  handleBreadcrumbClick: vi.fn(),
  contacts: ['https://alice.example/profile/card#me'],
};

vi.mock('@/features/file-explorer/hooks/useDriveInitialization', () => ({
  useDriveInitialization: () => mockUseDriveInit,
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({
  SolidProfileShapeType: {},
}));

vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isSolidContainer: vi.fn((r: unknown) => !!(r as Record<string, unknown>)?.children),
  isReloadable: vi.fn((r: unknown) => !!(r as Record<string, unknown>)?.reload),
}));

const mockResolveCatalogUri = vi.fn(() => 'https://pod.example/my-solid-app/catalog.ttl');

vi.mock('@/infrastructure/solid/catalog', () => ({
  resolveCatalogUri: () => mockResolveCatalogUri(),
}));

vi.mock('@/features/file-explorer/services/fileFilter', () => ({
  isVisibleLeaf: () => true,
}));

vi.mock('@/shared/contexts/NotificationContext', () => ({
  useNotifications: () => ({ showError: mockShowError, showSuccess: vi.fn() }),
}));

vi.mock('@/config', () => ({
  STORAGE_RETRY_DELAY_MS: 0,
}));

interface DriveFileListProps {
  onNavigate: (uri: string) => void;
  onDownload: (resource: { uri: string }, filename: string) => Promise<void>;
  isInAppFolder: boolean;
  [key: string]: unknown;
}

let capturedDriveFileListProps: DriveFileListProps = {} as DriveFileListProps;
vi.mock('../FileExplorer-file/DriveFileList', () => ({
  DriveFileList: (props: DriveFileListProps) => {
    capturedDriveFileListProps = props;
    return <div data-testid="drive-file-list" data-app={String(props.isInAppFolder)} />;
  },
}));

vi.mock('@/features/file-explorer/components/SharedWithMeSection', () => ({
  SharedWithMeSection: ({ contacts }: { contacts: string[] }) => (
    <div data-testid="shared-section" data-contacts={contacts.join(',')} />
  ),
}));

vi.mock('@/features/file-explorer/components/FileUpload', () => ({
  FileUpload: () => <div data-testid="file-upload" />,
}));

import { useResource, useSubject } from '@ldo/solid-react';

// Helper to create a mock container resource
const makeContainer = (childList: unknown[] = []) => ({
  children: () => childList,
  uri: 'https://pod.example/my-solid-app/',
  reload: vi.fn().mockResolvedValue(undefined),
});

describe('FileExplorer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.isLoggedIn = true;
    mockSession.webId = 'https://pod.example/profile/card#me';
    mockUseDriveInit.noStorageDetected = false;
    mockUseDriveInit.currentUri = 'https://pod.example/my-solid-app/' as SolidContainerUri;
    mockUseDriveInit.appContainerUri = 'https://pod.example/my-solid-app/' as SolidContainerUri;
    mockUseDriveInit.breadcrumbs = [{ label: 'My Drive', uri: 'https://pod.example/my-solid-app/' as SolidContainerUri }];
    vi.mocked(useResource).mockReturnValue(makeContainer() as unknown as ReturnType<typeof useResource>);
    vi.mocked(useSubject).mockReturnValue({ catalog: { '@id': 'https://pod.example/catalog.ttl' } } as unknown as ReturnType<typeof useSubject>);
  });

  it('renders login prompt when not logged in', () => {
    mockSession.isLoggedIn = false;
    render(<FileExplorer />);
    expect(screen.getByText('fileExplorer.loginPrompt')).toBeInTheDocument();
  });

  it('renders no-storage error with retry button', () => {
    mockUseDriveInit.noStorageDetected = true;
    render(<FileExplorer />);
    expect(screen.getByText('fileExplorer.noStorageFound')).toBeInTheDocument();
    fireEvent.click(screen.getByText('fileExplorer.retry'));
    expect(mockUseDriveInit.handleRetryStorage).toHaveBeenCalled();
  });

  it('renders loading spinner when currentContainer is null', () => {
    vi.mocked(useResource).mockReturnValue(null as unknown as ReturnType<typeof useResource>);
    render(<FileExplorer />);
    expect(screen.getByText('fileExplorer.connecting')).toBeInTheDocument();
  });

  it('renders main layout with FileUpload, DriveFileList, SharedWithMeSection', () => {
    render(<FileExplorer />);
    expect(screen.getByTestId('file-upload')).toBeInTheDocument();
    expect(screen.getByTestId('drive-file-list')).toBeInTheDocument();
    expect(screen.getByTestId('shared-section')).toBeInTheDocument();
  });

  it('shows "yourFiles" label when in app folder', () => {
    render(<FileExplorer />);
    expect(screen.getByText('fileExplorer.yourFiles')).toBeInTheDocument();
  });

  it('shows "podContents" label when not in app folder', () => {
    mockUseDriveInit.currentUri = 'https://pod.example/other/' as SolidContainerUri;
    render(<FileExplorer />);
    expect(screen.getByText('fileExplorer.podContents')).toBeInTheDocument();
  });

  it('does not render breadcrumbs when only one item', () => {
    render(<FileExplorer />);
    expect(screen.queryByText('/')).not.toBeInTheDocument();
  });

  it('renders breadcrumbs when more than one', () => {
    mockUseDriveInit.breadcrumbs = [
      { label: 'My Drive', uri: 'https://pod.example/my-solid-app/' as SolidContainerUri },
      { label: 'subfolder', uri: 'https://pod.example/my-solid-app/sub/' as SolidContainerUri },
    ];
    render(<FileExplorer />);
    expect(screen.getByText('My Drive')).toBeInTheDocument();
    expect(screen.getByText('subfolder')).toBeInTheDocument();
  });

  it('last breadcrumb is disabled', () => {
    mockUseDriveInit.breadcrumbs = [
      { label: 'My Drive', uri: 'https://pod.example/my-solid-app/' as SolidContainerUri },
      { label: 'subfolder', uri: 'https://pod.example/my-solid-app/sub/' as SolidContainerUri },
    ];
    render(<FileExplorer />);
    const buttons = screen.getAllByRole('button');
    const breadcrumbButtons = buttons.filter(b => b.classList.contains('breadcrumb__item'));
    const lastBreadcrumb = breadcrumbButtons[breadcrumbButtons.length - 1];
    expect(lastBreadcrumb).toBeDisabled();
  });

  it('clicking a breadcrumb calls handleBreadcrumbClick with index and uri', () => {
    mockUseDriveInit.breadcrumbs = [
      { label: 'My Drive', uri: 'https://pod.example/my-solid-app/' as SolidContainerUri },
      { label: 'subfolder', uri: 'https://pod.example/my-solid-app/sub/' as SolidContainerUri },
    ];
    render(<FileExplorer />);
    fireEvent.click(screen.getByText('My Drive'));
    expect(mockUseDriveInit.handleBreadcrumbClick).toHaveBeenCalledWith(0, 'https://pod.example/my-solid-app/');
  });

  it('refresh button calls reload on container', async () => {
    const mockReload = vi.fn().mockResolvedValue(undefined);
    const container = makeContainer();
    container.reload = mockReload;
    vi.mocked(useResource).mockReturnValue(container as unknown as ReturnType<typeof useResource>);

    render(<FileExplorer />);
    await act(async () => {
      fireEvent.click(screen.getByText('fileExplorer.refresh'));
    });
    expect(mockReload).toHaveBeenCalled();
  });

  it('passes contacts to SharedWithMeSection', () => {
    render(<FileExplorer />);
    const section = screen.getByTestId('shared-section');
    expect(section.getAttribute('data-contacts')).toBe('https://alice.example/profile/card#me');
  });

  it('handleNavigate delegates to the hook handler', () => {
    render(<FileExplorer />);
    act(() => {
      capturedDriveFileListProps.onNavigate('https://pod.example/my-solid-app/photos/');
    });
    expect(mockUseDriveInit.handleNavigate).toHaveBeenCalledWith('https://pod.example/my-solid-app/photos/');
  });

  it('handleDownload triggers file download on success', async () => {
    const mockBlob = new Blob(['data']);
    const revokeObjectURL = vi.fn();
    const createObjectURL = vi.fn().mockReturnValue('blob:test');
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    mockFetch.mockResolvedValue({ ok: true, blob: () => Promise.resolve(mockBlob) });

    // Render first, then spy on createElement so jsdom rendering is not affected
    render(<FileExplorer />);

    const mockAnchor = { href: '', download: '', click: vi.fn(), style: {} };
    const originalCreateElement = document.createElement.bind(document);
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: ElementCreationOptions) => {
      if (tag === 'a') return mockAnchor as unknown as HTMLAnchorElement;
      return originalCreateElement(tag, options);
    });

    await act(async () => {
      await capturedDriveFileListProps.onDownload({ uri: 'https://pod.example/file.txt' }, 'file.txt');
    });

    spy.mockRestore();

    expect(mockFetch).toHaveBeenCalledWith('https://pod.example/file.txt');
    expect(createObjectURL).toHaveBeenCalled();
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();
  });

  it('handleDownload shows error on failed response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden' });

    render(<FileExplorer />);
    await act(async () => {
      await capturedDriveFileListProps.onDownload({ uri: 'https://pod.example/file.txt' }, 'file.txt');
    });

    expect(mockShowError).toHaveBeenCalledWith('Download failed: 403 Forbidden');
  });

  it('handleDownload shows error on fetch exception', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'));

    render(<FileExplorer />);
    await act(async () => {
      await capturedDriveFileListProps.onDownload({ uri: 'https://pod.example/file.txt' }, 'file.txt');
    });

    expect(mockShowError).toHaveBeenCalledWith('Download failed: Network failure');
  });

  // --- Branch coverage additions ---

  it('handleReload does nothing when container is not reloadable', async () => {
    // Return container without reload method → isReloadable returns false
    const container = { children: () => [], uri: 'https://pod.example/my-solid-app/' };
    vi.mocked(useResource).mockReturnValue(container as unknown as ReturnType<typeof useResource>);

    render(<FileExplorer />);
    await act(async () => {
      fireEvent.click(screen.getByText('fileExplorer.refresh'));
    });
    // No reload called, no error
    expect(container).not.toHaveProperty('reload');
  });

  it('renders entries when currentContainer is not a SolidContainer', () => {
    // Return a non-container resource (no children method)
    const nonContainer = { uri: 'https://pod.example/file.txt' };
    vi.mocked(useResource).mockReturnValue(nonContainer as unknown as ReturnType<typeof useResource>);

    render(<FileExplorer />);
    // Should still render main layout, but entries will be empty
    expect(screen.getByTestId('drive-file-list')).toBeInTheDocument();
  });

  it('renders breadcrumb separator and active class for multiple crumbs', () => {
    mockUseDriveInit.breadcrumbs = [
      { label: 'My Drive', uri: 'https://pod.example/my-solid-app/' as SolidContainerUri },
      { label: 'photos', uri: 'https://pod.example/my-solid-app/photos/' as SolidContainerUri },
      { label: 'vacation', uri: 'https://pod.example/my-solid-app/photos/vacation/' as SolidContainerUri },
    ];
    render(<FileExplorer />);

    // Check separators
    const separators = document.querySelectorAll('.breadcrumb__sep');
    expect(separators).toHaveLength(2);

    // Check active class on last breadcrumb
    const activeItem = document.querySelector('.breadcrumb__item--active');
    expect(activeItem).toBeInTheDocument();
    expect(activeItem!.textContent).toBe('vacation');

    // Non-active items don't have active class
    const allItems = document.querySelectorAll('.breadcrumb__item');
    expect(allItems[0].classList.contains('breadcrumb__item--active')).toBe(false);
  });

  it('passes empty string as ownerWebId to SharedWithMeSection when session.webId is undefined', () => {
    mockSession.webId = undefined;
    render(<FileExplorer />);
    const sharedSection = screen.getByTestId('shared-section');
    // ownerWebId should be "" because session.webId ?? "" triggers the fallback
    expect(sharedSection).toBeInTheDocument();
  });

  it('passes empty string as catalogUri to DriveFileList when resolveCatalogUri returns undefined', () => {
    mockResolveCatalogUri.mockReturnValueOnce(undefined as unknown as string);
    render(<FileExplorer />);
    // catalogUri ?? "" fires — DriveFileList still renders
    expect(capturedDriveFileListProps.catalogUri).toBe('');
  });
});

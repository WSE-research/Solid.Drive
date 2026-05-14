import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { OneDriveLayout } from '../OneDriveLayout-file/OneDriveLayout';

vi.mock('@/features/onedrive-layout/components/NavRail', () => ({
  NavRail: ({
    onFilesPicked,
    onNewFolder,
  }: {
    onFilesPicked?: (files: File[]) => void;
    onNewFolder?: () => void;
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
      <div data-testid="view-my-files">
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
          toggle
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
        <button type="button" data-testid="close-details" onClick={props.onClose}>
          close
        </button>
      </div>
    );
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string, fallback?: string) => fallback ?? key],
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
    render(<OneDriveLayout />);
    expect(screen.getByTestId('view-recent')).toBeInTheDocument();
  });

  it.each([
    ['my-files', 'view-my-files'],
    ['shared', 'view-shared'],
    ['requests', 'view-requests'],
    ['people', 'view-people'],
  ])('renders the right view when ?view=%s', (param, testId) => {
    window.history.replaceState({}, '', `/?view=${param}`);
    render(<OneDriveLayout />);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });

  it('falls back to the recent view on an unknown ?view= value', () => {
    window.history.replaceState({}, '', '/?view=banana');
    render(<OneDriveLayout />);
    expect(screen.getByTestId('view-recent')).toBeInTheDocument();
  });

  it('picking files from the rail switches to my-files and seeds pickedFile + showUpload', () => {
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

  it('clicking new folder switches to my-files and sets showNewFolder', () => {
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

  it('upload-done clears both showUpload and pickedFile', () => {
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

  it('onRequestUpload from MyFilesView opens the upload form', () => {
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

  it('onNewFolderDone from MyFilesView clears showNewFolder', () => {
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

  it('selecting a row in MyFilesView writes selectedUri into the layout state', () => {
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

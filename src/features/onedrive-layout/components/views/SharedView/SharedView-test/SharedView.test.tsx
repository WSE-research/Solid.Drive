import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';

const mockContacts: { current: string[] } = { current: [] };
let mockWebId: string | undefined = 'https://owner.example/profile/card#me';
const mockSolidFetch = vi.fn();
vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ session: { webId: mockWebId }, fetch: mockSolidFetch }),
}));

const mockShowError = vi.fn();
vi.mock('@/shared/contexts/NotificationContext', () => ({
  useNotifications: () => ({ showError: mockShowError }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (_key: string, fallbackOrOpts?: unknown) =>
      typeof fallbackOrOpts === 'string'
        ? fallbackOrOpts
        : ((fallbackOrOpts as { defaultValue?: string } | undefined)?.defaultValue ?? _key),
  ],
}));

const mockDownloadResource = vi.fn();
vi.mock('@/features/file-explorer/services/downloadResource', () => ({
  downloadResource: (...args: unknown[]) => mockDownloadResource(...args),
}));

vi.mock('@/features/onedrive-layout/components/FilePreviewDialog', () => ({
  FilePreviewDialog: (props: Record<string, unknown>) => {
    if (!props.open) return null;
    return (
      <onedrive-view
        data-testid="preview-dialog"
        data-binary-uri={String(props.binaryUri)}
        data-title={String(props.title)}
        data-media-type={String(props.mediaType)}
      >
        <button
          data-testid="preview-close"
          onClick={() => (props.onOpenChange as (next: boolean) => void)(false)}
        >
          close
        </button>
        <button
          data-testid="preview-download"
          onClick={() => (props.onDownload as () => void)()}
        >
          download
        </button>
      </onedrive-view>
    );
  },
}));

vi.mock('@/features/file-explorer/hooks/useContacts', () => ({
  useContacts: () => mockContacts.current,
}));

let lastToolbarProps: Record<string, unknown> | undefined;
vi.mock('@/features/onedrive-layout/components/views/SharedView/SharedView-file/SharedToolbar', () => ({
  SharedToolbar: (props: Record<string, unknown>) => {
    lastToolbarProps = props;
    return (
      <shared-toolbar data-testid="shared-toolbar" data-tab={String(props.tab)}>
        <button data-testid="select-by-you" onClick={() => (props.onTabChange as (next: string) => void)('by-you')}>
          By you
        </button>
      </shared-toolbar>
    );
  },
}));

let lastBodyProps: Record<string, unknown> | undefined;
vi.mock('@/features/onedrive-layout/components/views/SharedView/SharedView-file/SharedBody', () => ({
  SharedBody: (props: Record<string, unknown>) => {
    lastBodyProps = props;
    const onSelect = props.onSelect as (next: {
      entryUri: string;
      binaryUri: string;
      title: string;
      mediaType: string;
    }) => void;
    return (
      <shared-body
        data-testid="shared-body"
        data-tab={String(props.tab)}
        data-contact-count={(props.contacts as string[]).length}
        data-selected-entry={String(props.selectedEntryUri ?? '')}
      >
        <button
          data-testid="select-entry"
          onClick={() =>
            onSelect({
              entryUri: 'https://alice.example/files/notes/index.ttl',
              binaryUri: 'https://alice.example/files/notes/binary',
              title: 'Game design',
              mediaType: 'application/pdf',
            })
          }
        >
          select
        </button>
      </shared-body>
    );
  },
}));

vi.mock('@/features/onedrive-layout/components/views/SharedView/SharedView-file/SharedSelectionToolbar', () => ({
  SharedSelectionToolbar: (props: Record<string, unknown>) => (
    <page-header data-testid="shared-selection-toolbar" data-count={String(props.count)}>
      <button
        data-testid="selection-open"
        onClick={() => (props.onOpen as () => void)()}
      >
        open
      </button>
      <button
        data-testid="selection-download"
        onClick={() => (props.onDownload as () => void)()}
      >
        download
      </button>
      <button
        data-testid="selection-clear"
        onClick={() => (props.onClear as () => void)()}
      >
        clear
      </button>
    </page-header>
  ),
}));

import { SharedView } from '../SharedView-file/SharedView';

describe('SharedView', () => {
  beforeEach(() => {
    mockContacts.current = [];
    lastToolbarProps = undefined;
    lastBodyProps = undefined;
    mockWebId = 'https://owner.example/profile/card#me';
    mockShowError.mockReset();
    mockDownloadResource.mockReset();
    mockDownloadResource.mockResolvedValue({ ok: true });
    mockSolidFetch.mockReset();
  });

  it('renders both the toolbar and the body siblings', () => {
    render(<SharedView />);
    expect(screen.getByTestId('shared-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('shared-body')).toBeInTheDocument();
  });

  it('starts on the "with-you" tab and routes the tab id to both children', () => {
    render(<SharedView />);
    expect(screen.getByTestId('shared-toolbar').getAttribute('data-tab')).toBe('with-you');
    expect(screen.getByTestId('shared-body').getAttribute('data-tab')).toBe('with-you');
  });

  it('switches the active tab when the toolbar fires onTabChange', () => {
    render(<SharedView />);
    fireEvent.click(screen.getByTestId('select-by-you'));
    expect(screen.getByTestId('shared-toolbar').getAttribute('data-tab')).toBe('by-you');
    expect(screen.getByTestId('shared-body').getAttribute('data-tab')).toBe('by-you');
  });

  it('filters out the owner WebID from the contacts list passed to the body', () => {
    mockContacts.current = [
      'https://owner.example/profile/card#me',
      'https://alice.example/profile/card#me',
    ];
    render(<SharedView />);
    expect(screen.getByTestId('shared-body').getAttribute('data-contact-count')).toBe('1');
    expect(lastBodyProps?.contacts).toEqual(['https://alice.example/profile/card#me']);
  });

  it('shares the same filters reference between toolbar and body', () => {
    render(<SharedView />);
    expect(lastToolbarProps?.filters).toBe(lastBodyProps?.filters);
  });

  it('shares the same chip list reference between toolbar and body', () => {
    render(<SharedView />);
    expect(lastToolbarProps?.chips).toBe(lastBodyProps?.chips);
  });

  it('does not switch tab when onTabChange is called with the same tab', () => {
    render(<SharedView />);
    fireEvent.click(screen.getByTestId('select-by-you'));
    expect(screen.getByTestId('shared-toolbar').getAttribute('data-tab')).toBe('by-you');
    // Clicking the same tab again should hit the early-return branch and leave the tab unchanged.
    fireEvent.click(screen.getByTestId('select-by-you'));
    expect(screen.getByTestId('shared-toolbar').getAttribute('data-tab')).toBe('by-you');
  });

  it('falls back to empty string ownerWebId when session.webId is undefined', () => {
    mockWebId = undefined;
    mockContacts.current = ['https://alice.example/profile/card#me'];
    render(<SharedView />);
    // When ownerWebId is the empty string, alice still passes the `webId !== ownerWebId` filter and stays in the list.
    expect(screen.getByTestId('shared-body').getAttribute('data-contact-count')).toBe('1');
  });

  it('swaps the toolbar for the selection toolbar when a row is selected', () => {
    render(<SharedView />);
    expect(screen.getByTestId('shared-toolbar')).toBeInTheDocument();
    expect(screen.queryByTestId('shared-selection-toolbar')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('select-entry'));

    expect(screen.queryByTestId('shared-toolbar')).not.toBeInTheDocument();
    expect(screen.getByTestId('shared-selection-toolbar')).toBeInTheDocument();
    expect(
      screen.getByTestId('shared-selection-toolbar').getAttribute('data-count'),
    ).toBe('1');
    expect(screen.getByTestId('shared-body').getAttribute('data-selected-entry')).toBe(
      'https://alice.example/files/notes/index.ttl',
    );
  });

  it('clears the selection when the toolbar fires onClear', () => {
    render(<SharedView />);
    fireEvent.click(screen.getByTestId('select-entry'));
    fireEvent.click(screen.getByTestId('selection-clear'));
    expect(screen.getByTestId('shared-toolbar')).toBeInTheDocument();
    expect(screen.queryByTestId('shared-selection-toolbar')).not.toBeInTheDocument();
  });

  it('toggles the selection off when the same entry is selected twice', () => {
    render(<SharedView />);
    fireEvent.click(screen.getByTestId('select-entry'));
    expect(screen.getByTestId('shared-selection-toolbar')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('select-entry'));
    expect(screen.queryByTestId('shared-selection-toolbar')).not.toBeInTheDocument();
  });

  it('clears the selection on Escape', () => {
    render(<SharedView />);
    fireEvent.click(screen.getByTestId('select-entry'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('shared-selection-toolbar')).not.toBeInTheDocument();
  });

  it('opens the in-app preview dialog with the selected entry on Open', () => {
    render(<SharedView />);
    fireEvent.click(screen.getByTestId('select-entry'));
    expect(screen.queryByTestId('preview-dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('selection-open'));
    const dialog = screen.getByTestId('preview-dialog');
    expect(dialog.getAttribute('data-binary-uri')).toBe(
      'https://alice.example/files/notes/binary',
    );
    expect(dialog.getAttribute('data-title')).toBe('Game design');
    expect(dialog.getAttribute('data-media-type')).toBe('application/pdf');
  });

  it('closes the preview dialog when the dialog signals onOpenChange(false)', () => {
    render(<SharedView />);
    fireEvent.click(screen.getByTestId('select-entry'));
    fireEvent.click(screen.getByTestId('selection-open'));
    fireEvent.click(screen.getByTestId('preview-close'));
    expect(screen.queryByTestId('preview-dialog')).not.toBeInTheDocument();
  });

  it('downloads from inside the preview dialog via the same download handler', async () => {
    render(<SharedView />);
    fireEvent.click(screen.getByTestId('select-entry'));
    fireEvent.click(screen.getByTestId('selection-open'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('preview-download'));
    });
    expect(mockDownloadResource).toHaveBeenCalledWith(
      'https://alice.example/files/notes/binary',
      'Game design',
      mockSolidFetch,
    );
  });

  it('downloads the selected binary via downloadResource', async () => {
    render(<SharedView />);
    fireEvent.click(screen.getByTestId('select-entry'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('selection-download'));
    });
    expect(mockDownloadResource).toHaveBeenCalledWith(
      'https://alice.example/files/notes/binary',
      'Game design',
      mockSolidFetch,
    );
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it('surfaces a toast when downloadResource fails', async () => {
    mockDownloadResource.mockResolvedValueOnce({ ok: false, reason: '404 Not Found' });
    render(<SharedView />);
    fireEvent.click(screen.getByTestId('select-entry'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('selection-download'));
    });
    expect(mockShowError).toHaveBeenCalledWith(
      expect.stringContaining('404 Not Found'),
    );
  });
});

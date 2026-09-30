import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { FolderEntry } from '../FolderEntry-file/FolderEntry';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

const mockFetch = vi.fn();
vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ fetch: mockFetch }),
}));

const mockConfirm = vi.fn();
const mockShowError = vi.fn();
vi.mock('@/shared/contexts/NotificationContext', () => ({
  useNotifications: () => ({ confirm: mockConfirm, showError: mockShowError }),
}));

const mockDeleteResource = vi.fn();
vi.mock('@/features/file-explorer/services/deleteResource', () => ({
  deleteResource: (...args: unknown[]) => mockDeleteResource(...args),
}));

const mockSoftDeleteFolder = vi.fn();
vi.mock('@/features/file-explorer/services/softDeleteFolder', () => ({
  softDeleteFolder: (...args: unknown[]) => mockSoftDeleteFolder(...args),
}));

const CATALOG_URI = 'https://pod.example.com/catalog.ttl';
const STORAGE_ROOT_URI = 'https://pod.example.com/';
const OWNER_WEB_ID = 'https://pod.example.com/profile/card#me';

describe('FolderEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockResolvedValue(false);
    mockDeleteResource.mockResolvedValue({ ok: true });
    mockSoftDeleteFolder.mockResolvedValue({ ok: true, trashItemContainerUri: 'https://pod.example.com/trash/x/' });
  });

  it('extracts and displays the folder name from the URI', () => {
    render(<FolderEntry uri="https://pod.example.com/my-app/documents/" onNavigate={vi.fn()} />);
    expect(screen.getByText('documents')).toBeInTheDocument();
  });

  it('decodes percent-encoded characters in the folder name', () => {
    render(<FolderEntry uri="https://pod.example.com/my-app/my%20folder/" onNavigate={vi.fn()} />);
    expect(screen.getByText('my folder')).toBeInTheDocument();
  });

  it('calls onNavigate with the full URI when clicked', () => {
    const onNavigate = vi.fn();
    const uri = 'https://pod.example.com/my-app/documents/';
    render(<FolderEntry uri={uri} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onNavigate).toHaveBeenCalledWith(uri);
  });

  it('calls onNavigate exactly once per click', () => {
    const onNavigate = vi.fn();
    render(<FolderEntry uri="https://pod.example.com/folder/" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('extracts folder name correctly from a URI without a trailing slash', () => {
    render(<FolderEntry uri="https://pod.example.com/folder" onNavigate={vi.fn()} />);
    expect(screen.getByText('folder')).toBeInTheDocument();
  });

  it('shows the catalog title instead of the URI slug when provided', () => {
    render(<FolderEntry uri="https://pod.example.com/my-app/q1-docs/" title="Q1 Docs" onNavigate={vi.fn()} />);
    expect(screen.getByText('Q1 Docs')).toBeInTheDocument();
    expect(screen.queryByText('q1-docs')).not.toBeInTheDocument();
  });

  it('renders the folder icon and arrow as CSS icon spans', () => {
    const { container } = render(<FolderEntry uri="https://pod.example.com/test/" onNavigate={vi.fn()} />);
    expect(container.querySelector('.icon--folder')).toBeInTheDocument();
    expect(container.querySelector('.folder-entry__arrow')).toBeInTheDocument();
  });

  it('renders a clickable button even when URI is an empty string', () => {
    render(<FolderEntry uri="" onNavigate={vi.fn()} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('does not attach DnD listeners when onDrop is not provided', () => {
    const { container } = render(<FolderEntry uri="https://pod.example/x/" onNavigate={vi.fn()} />);
    expect(container.querySelector('.folder-entry--drop-target')).toBeNull();
  });

  it('calls onDrop with the dropped files, target uri, and the raw DataTransfer', () => {
    const onDrop = vi.fn();
    const { container } = render(
      <FolderEntry uri="https://pod.example/photos/" onNavigate={vi.fn()} onDrop={onDrop} onDragOverChange={vi.fn()} />
    );
    const row = container.querySelector('folder-entry')!;
    const file = new File(['x'], 'a.txt', { type: 'text/plain' });
    const dataTransfer = { files: [file], types: ['Files'] };
    fireEvent.drop(row, { dataTransfer });
    expect(onDrop).toHaveBeenCalledWith([file], 'https://pod.example/photos/', expect.any(Object));
  });

  it('pings onDragOverChange when files enter and leave', () => {
    const onDragOverChange = vi.fn();
    const { container } = render(
      <FolderEntry uri="https://pod.example/photos/" onNavigate={vi.fn()} onDrop={vi.fn()} onDragOverChange={onDragOverChange} />
    );
    const row = container.querySelector('folder-entry')!;
    fireEvent.dragEnter(row, { dataTransfer: { types: ['Files'] } });
    expect(onDragOverChange).toHaveBeenCalledWith(true);
    fireEvent.dragLeave(row);
    expect(onDragOverChange).toHaveBeenCalledWith(false);
  });

  it('applies the drop-target modifier class while a file is over the card', () => {
    const { container } = render(
      <FolderEntry uri="https://pod.example/photos/" onNavigate={vi.fn()} onDrop={vi.fn()} onDragOverChange={vi.fn()} />
    );
    const row = container.querySelector('folder-entry')!;
    fireEvent.dragEnter(row, { dataTransfer: { types: ['Files'] } });
    expect(row.classList.contains('folder-entry--drop-target')).toBe(true);
    fireEvent.dragLeave(row);
    expect(row.classList.contains('folder-entry--drop-target')).toBe(false);
  });

  it('drag-over with Files preventDefaults so the browser fires drop', () => {
    const { container } = render(
      <FolderEntry uri="https://pod.example/photos/" onNavigate={vi.fn()} onDrop={vi.fn()} onDragOverChange={vi.fn()} />
    );
    const row = container.querySelector('folder-entry')!;
    const prevented = !fireEvent.dragOver(row, { dataTransfer: { types: ['Files'] } });
    expect(prevented).toBe(true);
  });

  it('drag-over with non-Files data does not preventDefault', () => {
    const { container } = render(
      <FolderEntry uri="https://pod.example/photos/" onNavigate={vi.fn()} onDrop={vi.fn()} onDragOverChange={vi.fn()} />
    );
    const row = container.querySelector('folder-entry')!;
    const prevented = !fireEvent.dragOver(row, { dataTransfer: { types: ['text/plain'] } });
    expect(prevented).toBe(false);
  });

  it('drag-enter with non-Files data is ignored', () => {
    const onDragOverChange = vi.fn();
    const { container } = render(
      <FolderEntry uri="https://pod.example/photos/" onNavigate={vi.fn()} onDrop={vi.fn()} onDragOverChange={onDragOverChange} />
    );
    const row = container.querySelector('folder-entry')!;
    fireEvent.dragEnter(row, { dataTransfer: { types: ['text/plain'] } });
    expect(onDragOverChange).not.toHaveBeenCalled();
  });

  describe('delete', () => {
    const FOLDER_URI = 'https://pod.example.com/my-app/documents/';

    it('hides the delete button when no catalogUri is given', () => {
      render(<FolderEntry uri={FOLDER_URI} onNavigate={vi.fn()} />);
      expect(screen.queryByRole('button', { name: 'fileExplorer.deleteFolder' })).not.toBeInTheDocument();
    });

    it('shows the delete button when catalogUri is given', () => {
      render(<FolderEntry uri={FOLDER_URI} catalogUri={CATALOG_URI} onNavigate={vi.fn()} />);
      expect(screen.getByRole('button', { name: 'fileExplorer.deleteFolder' })).toBeInTheDocument();
    });

    it('asks for confirmation and does not delete when cancelled', async () => {
      mockConfirm.mockResolvedValue(false);
      render(<FolderEntry uri={FOLDER_URI} catalogUri={CATALOG_URI} onNavigate={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'fileExplorer.deleteFolder' }));
      await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith('fileExplorer.deleteFolderConfirmPermanent'));
      expect(mockDeleteResource).not.toHaveBeenCalled();
    });

    it('does not navigate into the folder when the delete button is clicked', () => {
      const onNavigate = vi.fn();
      render(<FolderEntry uri={FOLDER_URI} catalogUri={CATALOG_URI} onNavigate={onNavigate} />);
      fireEvent.click(screen.getByRole('button', { name: 'fileExplorer.deleteFolder' }));
      expect(onNavigate).not.toHaveBeenCalled();
    });

    describe('without storageRootUri/ownerWebId (soft-delete prerequisites missing)', () => {
      it('deletes the folder permanently, using its own URI as both container and catalog key, when confirmed', async () => {
        mockConfirm.mockResolvedValue(true);
        render(<FolderEntry uri={FOLDER_URI} catalogUri={CATALOG_URI} onNavigate={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'fileExplorer.deleteFolder' }));
        await waitFor(() =>
          expect(mockDeleteResource).toHaveBeenCalledWith({
            containerUri: FOLDER_URI,
            metadataUri: FOLDER_URI,
            catalogUri: CATALOG_URI,
            fetch: mockFetch,
          }),
        );
        expect(mockSoftDeleteFolder).not.toHaveBeenCalled();
      });

      it('surfaces a showError toast when the permanent delete fails', async () => {
        mockConfirm.mockResolvedValue(true);
        mockDeleteResource.mockResolvedValue({ ok: false, reason: '409 Conflict' });
        render(<FolderEntry uri={FOLDER_URI} catalogUri={CATALOG_URI} onNavigate={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'fileExplorer.deleteFolder' }));
        await waitFor(() => expect(mockShowError).toHaveBeenCalled());
        expect(mockShowError.mock.calls[0][0]).toContain('409 Conflict');
      });
    });

    describe('with storageRootUri and ownerWebId (soft-delete available)', () => {
      const softDeleteProps = { catalogUri: CATALOG_URI, storageRootUri: STORAGE_ROOT_URI, ownerWebId: OWNER_WEB_ID };

      it('asks to move the folder to the Recycle bin, not delete it permanently', async () => {
        render(<FolderEntry uri={FOLDER_URI} {...softDeleteProps} onNavigate={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'fileExplorer.deleteFolder' }));
        await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith('fileExplorer.deleteFolderConfirm'));
      });

      it('moves the folder to the Recycle bin instead of deleting it permanently, when confirmed', async () => {
        mockConfirm.mockResolvedValue(true);
        render(<FolderEntry uri={FOLDER_URI} {...softDeleteProps} onNavigate={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'fileExplorer.deleteFolder' }));
        await waitFor(() =>
          expect(mockSoftDeleteFolder).toHaveBeenCalledWith({
            containerUri: FOLDER_URI,
            storageRootUri: STORAGE_ROOT_URI,
            catalogUri: CATALOG_URI,
            ownerWebId: OWNER_WEB_ID,
            fetch: mockFetch,
          }),
        );
        expect(mockDeleteResource).not.toHaveBeenCalled();
      });

      it('surfaces a showError toast when the soft delete fails', async () => {
        mockConfirm.mockResolvedValue(true);
        mockSoftDeleteFolder.mockResolvedValue({ ok: false, reason: '403 Forbidden' });
        render(<FolderEntry uri={FOLDER_URI} {...softDeleteProps} onNavigate={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'fileExplorer.deleteFolder' }));
        await waitFor(() => expect(mockShowError).toHaveBeenCalled());
        expect(mockShowError.mock.calls[0][0]).toContain('403 Forbidden');
      });
    });

    it('still shows the navigation button alongside the delete button', () => {
      render(<FolderEntry uri={FOLDER_URI} catalogUri={CATALOG_URI} onNavigate={vi.fn()} />);
      const nav = within(screen.getByText('documents').closest('button')!);
      expect(nav.getByText('documents')).toBeInTheDocument();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const mockCopyToClipboard = vi.fn();
const mockDownloadResource = vi.fn();
const mockDeleteResource = vi.fn();
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
const mockConfirm = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, fallbackOrOpts?: unknown) =>
      typeof fallbackOrOpts === 'string'
        ? fallbackOrOpts
        : (fallbackOrOpts as { defaultValue?: string } | undefined)?.defaultValue ?? key,
  ],
}));

vi.mock('@/shared/contexts/NotificationContext', () => ({
  useNotifications: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    confirm: mockConfirm,
  }),
}));

vi.mock('@/shared/utils/copyToClipboard', () => ({
  copyToClipboard: (...args: unknown[]) => mockCopyToClipboard(...args),
}));

vi.mock('@/features/file-explorer/services/downloadResource', () => ({
  downloadResource: (...args: unknown[]) => mockDownloadResource(...args),
}));

vi.mock('@/features/file-explorer/services/deleteResource', () => ({
  deleteResource: (...args: unknown[]) => mockDeleteResource(...args),
}));

const mockSoftDeleteFile = vi.fn();
vi.mock('@/features/file-explorer/services/softDeleteFile', () => ({
  softDeleteFile: (...args: unknown[]) => mockSoftDeleteFile(...args),
}));

import { useOneDriveActions } from '../useOneDriveActions-file/useOneDriveActions';
import type { CatalogEntry, SharedEntry } from '@/types';

const sampleSharedEntry: SharedEntry = {
  metadataUri: 'https://pod.example/app/doc/index.ttl',
  binaryUri: 'https://pod.example/app/doc/binary',
  classUri: 'http://schema.org/MediaObject',
  mediaType: 'application/pdf',
  byteSize: 1024,
  title: 'doc.pdf',
  description: '',
  modified: '2026-04-01T00:00:00Z',
};

const fileSelection = {
  kind: 'file' as const,
  uri: 'https://pod.example/app/doc/',
  name: 'doc.pdf',
};
const folderSelection = {
  kind: 'folder' as const,
  uri: 'https://pod.example/app/folder/',
  name: 'folder',
};

const sampleCatalogEntry: CatalogEntry = {
  uri: 'https://pod.example/app/doc/index.ttl',
  conformsTo: 'http://schema.org/MediaObject',
  title: 'doc.pdf',
  description: '',
  modified: '2026-04-01T00:00:00Z',
  publisher: 'https://owner/me',
  mediaType: 'application/pdf',
  byteSize: 1024,
  accessURL: 'https://pod.example/app/doc/binary',
};

const buildArgs = (overrides: Partial<Parameters<typeof useOneDriveActions>[0]> = {}) => ({
  selected: fileSelection,
  catalogByContainer: new Map<string, CatalogEntry>([
    [fileSelection.uri, sampleCatalogEntry],
  ]),
  catalogUri: 'https://pod.example/app/catalog.ttl',
  solidFetch: vi.fn() as unknown as typeof fetch,
  onAfterDelete: vi.fn(),
  ...overrides,
});

describe('useOneDriveActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCopyToClipboard.mockResolvedValue(true);
    mockDownloadResource.mockResolvedValue({ ok: true });
    mockDeleteResource.mockResolvedValue({ ok: true });
    mockSoftDeleteFile.mockResolvedValue({ ok: true, trashItemContainerUri: 'https://pod.example/app/trash/doc/' });
    mockConfirm.mockResolvedValue(true);
  });

  describe('handleCopyLink', () => {
    it('copies the selected URI and shows a success toast', async () => {
      const { result } = renderHook(() => useOneDriveActions(buildArgs()));
      await act(async () => {
        await result.current.handleCopyLink();
      });
      expect(mockCopyToClipboard).toHaveBeenCalledWith(fileSelection.uri);
      expect(mockShowSuccess).toHaveBeenCalled();
      expect(mockShowError).not.toHaveBeenCalled();
    });

    it('shows an error toast when the clipboard write fails', async () => {
      mockCopyToClipboard.mockResolvedValueOnce(false);
      const { result } = renderHook(() => useOneDriveActions(buildArgs()));
      await act(async () => {
        await result.current.handleCopyLink();
      });
      expect(mockShowError).toHaveBeenCalled();
    });

    it('is a no-op when nothing is selected', async () => {
      const { result } = renderHook(() => useOneDriveActions(buildArgs({ selected: null })));
      await act(async () => {
        await result.current.handleCopyLink();
      });
      expect(mockCopyToClipboard).not.toHaveBeenCalled();
    });
  });

  describe('handleDownload', () => {
    it('downloads a file selection', async () => {
      const { result } = renderHook(() => useOneDriveActions(buildArgs()));
      await act(async () => {
        await result.current.handleDownload();
      });
      expect(mockDownloadResource).toHaveBeenCalled();
    });

    it('downloads the binary resource, not the file container', async () => {
      const { result } = renderHook(() =>
        useOneDriveActions(buildArgs({ entry: sampleSharedEntry })),
      );
      await act(async () => {
        await result.current.handleDownload();
      });
      expect(mockDownloadResource).toHaveBeenCalledWith(
        sampleSharedEntry.binaryUri,
        'binary',
        expect.anything(),
      );
    });

    it('falls back to the container uri when there is no catalog entry', async () => {
      const { result } = renderHook(() =>
        useOneDriveActions(buildArgs({ entry: null })),
      );
      await act(async () => {
        await result.current.handleDownload();
      });
      expect(mockDownloadResource).toHaveBeenCalledWith(
        fileSelection.uri,
        'doc',
        expect.anything(),
      );
    });

    it('shows an error toast when the download fails', async () => {
      mockDownloadResource.mockResolvedValueOnce({ ok: false, reason: 'network' });
      const { result } = renderHook(() => useOneDriveActions(buildArgs()));
      await act(async () => {
        await result.current.handleDownload();
      });
      expect(mockShowError).toHaveBeenCalled();
    });

    it('skips folders', async () => {
      const { result } = renderHook(() =>
        useOneDriveActions(buildArgs({ selected: folderSelection })),
      );
      await act(async () => {
        await result.current.handleDownload();
      });
      expect(mockDownloadResource).not.toHaveBeenCalled();
    });

    it('is a no-op when nothing is selected', async () => {
      const { result } = renderHook(() =>
        useOneDriveActions(buildArgs({ selected: null })),
      );
      await act(async () => {
        await result.current.handleDownload();
      });
      expect(mockDownloadResource).not.toHaveBeenCalled();
    });
  });

  describe('handleDelete', () => {
    it('confirms, deletes the resource, and calls onAfterDelete', async () => {
      const onAfterDelete = vi.fn();
      const { result } = renderHook(() =>
        useOneDriveActions(buildArgs({ onAfterDelete })),
      );
      await act(async () => {
        await result.current.handleDelete();
      });
      expect(mockConfirm).toHaveBeenCalled();
      expect(mockDeleteResource).toHaveBeenCalledWith(
        expect.objectContaining({ containerUri: fileSelection.uri }),
      );
      expect(mockShowSuccess).toHaveBeenCalled();
      expect(onAfterDelete).toHaveBeenCalledTimes(1);
    });

    it('does not delete when the user cancels the confirmation', async () => {
      mockConfirm.mockResolvedValueOnce(false);
      const onAfterDelete = vi.fn();
      const { result } = renderHook(() =>
        useOneDriveActions(buildArgs({ onAfterDelete })),
      );
      await act(async () => {
        await result.current.handleDelete();
      });
      expect(mockDeleteResource).not.toHaveBeenCalled();
      expect(onAfterDelete).not.toHaveBeenCalled();
    });

    it('shows an error toast and does not call onAfterDelete on failure', async () => {
      mockDeleteResource.mockResolvedValueOnce({ ok: false, reason: '500' });
      const onAfterDelete = vi.fn();
      const { result } = renderHook(() =>
        useOneDriveActions(buildArgs({ onAfterDelete })),
      );
      await act(async () => {
        await result.current.handleDelete();
      });
      expect(mockShowError).toHaveBeenCalled();
      expect(onAfterDelete).not.toHaveBeenCalled();
    });

    it('is a no-op when nothing is selected', async () => {
      const { result } = renderHook(() =>
        useOneDriveActions(buildArgs({ selected: null })),
      );
      await act(async () => {
        await result.current.handleDelete();
      });
      expect(mockConfirm).not.toHaveBeenCalled();
    });

    it('passes undefined catalogUri to deleteResource when the catalog has not resolved yet', async () => {
      const { result } = renderHook(() =>
        useOneDriveActions(buildArgs({ catalogUri: null })),
      );
      await act(async () => {
        await result.current.handleDelete();
      });
      expect(mockDeleteResource).toHaveBeenCalledWith(
        expect.objectContaining({ catalogUri: undefined }),
      );
    });

    const softDeleteArgs = () =>
      buildArgs({
        storageRootUri: 'https://pod.example/',
        entry: sampleSharedEntry,
        ownerWebId: 'https://owner.example/#me',
      });

    it('soft-deletes a file selection when storageRootUri, entry, and ownerWebId are all resolved', async () => {
      const onAfterDelete = vi.fn();
      const { result } = renderHook(() =>
        useOneDriveActions({ ...softDeleteArgs(), onAfterDelete }),
      );
      await act(async () => {
        await result.current.handleDelete();
      });
      expect(mockSoftDeleteFile).toHaveBeenCalledWith({
        containerUri: fileSelection.uri,
        storageRootUri: 'https://pod.example/',
        catalogUri: 'https://pod.example/app/catalog.ttl',
        entry: sampleSharedEntry,
        ownerWebId: 'https://owner.example/#me',
        fetch: expect.any(Function),
      });
      expect(mockDeleteResource).not.toHaveBeenCalled();
      expect(mockShowSuccess).toHaveBeenCalled();
      expect(onAfterDelete).toHaveBeenCalledTimes(1);
    });

    it('hard-deletes a folder selection even when soft-delete prerequisites are resolved', async () => {
      const { result } = renderHook(() =>
        useOneDriveActions({ ...softDeleteArgs(), selected: folderSelection }),
      );
      await act(async () => {
        await result.current.handleDelete();
      });
      expect(mockDeleteResource).toHaveBeenCalledWith(
        expect.objectContaining({ containerUri: folderSelection.uri }),
      );
      expect(mockSoftDeleteFile).not.toHaveBeenCalled();
    });

    it('falls back to deleteResource when storageRootUri is missing', async () => {
      const { result } = renderHook(() =>
        useOneDriveActions({ ...softDeleteArgs(), storageRootUri: undefined }),
      );
      await act(async () => {
        await result.current.handleDelete();
      });
      expect(mockDeleteResource).toHaveBeenCalled();
      expect(mockSoftDeleteFile).not.toHaveBeenCalled();
    });

    it('falls back to deleteResource when entry is missing', async () => {
      const { result } = renderHook(() =>
        useOneDriveActions({ ...softDeleteArgs(), entry: undefined }),
      );
      await act(async () => {
        await result.current.handleDelete();
      });
      expect(mockDeleteResource).toHaveBeenCalled();
      expect(mockSoftDeleteFile).not.toHaveBeenCalled();
    });

    it('falls back to deleteResource when ownerWebId is missing', async () => {
      const { result } = renderHook(() =>
        useOneDriveActions({ ...softDeleteArgs(), ownerWebId: undefined }),
      );
      await act(async () => {
        await result.current.handleDelete();
      });
      expect(mockDeleteResource).toHaveBeenCalled();
      expect(mockSoftDeleteFile).not.toHaveBeenCalled();
    });

    it('shows the permanent-delete confirm copy when falling back to hard delete', async () => {
      const { result } = renderHook(() => useOneDriveActions(buildArgs()));
      await act(async () => {
        await result.current.handleDelete();
      });
      expect(mockConfirm).toHaveBeenCalledWith(expect.stringContaining('cannot be undone'));
    });

    it('shows the Recycle-bin confirm copy when soft-deleting', async () => {
      const { result } = renderHook(() => useOneDriveActions(softDeleteArgs()));
      await act(async () => {
        await result.current.handleDelete();
      });
      expect(mockConfirm).toHaveBeenCalledWith(expect.stringContaining('Recycle bin'));
    });

    it('shows an error toast and does not call onAfterDelete when the soft delete fails', async () => {
      mockSoftDeleteFile.mockResolvedValueOnce({ ok: false, reason: '500' });
      const onAfterDelete = vi.fn();
      const { result } = renderHook(() =>
        useOneDriveActions({ ...softDeleteArgs(), onAfterDelete }),
      );
      await act(async () => {
        await result.current.handleDelete();
      });
      expect(mockShowError).toHaveBeenCalled();
      expect(onAfterDelete).not.toHaveBeenCalled();
    });

    it('shows the permission-denied reason when the soft delete is denied by WAC', async () => {
      mockSoftDeleteFile.mockResolvedValueOnce({
        ok: false,
        reason: 'Missing permission to delete this file',
      });
      const onAfterDelete = vi.fn();
      const { result } = renderHook(() =>
        useOneDriveActions({ ...softDeleteArgs(), onAfterDelete }),
      );
      await act(async () => {
        await result.current.handleDelete();
      });
      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringContaining('Missing permission to delete this file'),
      );
      expect(onAfterDelete).not.toHaveBeenCalled();
    });

    it('ignores a second handleDelete call fired synchronously while the first is still in flight', async () => {
      let resolveSoftDelete: ((value: { ok: true; trashItemContainerUri: string }) => void) | undefined;
      mockSoftDeleteFile.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSoftDelete = resolve;
        }),
      );
      const { result } = renderHook(() => useOneDriveActions(softDeleteArgs()));

      await act(async () => {
        // Simulates a rapid double-click: both invocations happen back-to-back,
        // synchronously, before either has awaited anything.
        const call1 = result.current.handleDelete();
        const call2 = result.current.handleDelete();
        resolveSoftDelete!({ ok: true, trashItemContainerUri: 'https://pod.example/app/trash/doc/' });
        await Promise.all([call1, call2]);
      });

      expect(mockSoftDeleteFile).toHaveBeenCalledTimes(1);
      expect(mockConfirm).toHaveBeenCalledTimes(1);
    });

    it('allows a new delete once the previous one has settled', async () => {
      const { result } = renderHook(() => useOneDriveActions(softDeleteArgs()));
      await act(async () => {
        await result.current.handleDelete();
      });
      await act(async () => {
        await result.current.handleDelete();
      });
      expect(mockSoftDeleteFile).toHaveBeenCalledTimes(2);
    });
  });
});

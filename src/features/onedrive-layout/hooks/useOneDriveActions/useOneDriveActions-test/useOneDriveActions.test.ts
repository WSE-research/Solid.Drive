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

import { useOneDriveActions } from '../useOneDriveActions-file/useOneDriveActions';
import type { CatalogEntry } from '@/types';

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
  });
});

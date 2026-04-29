import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockUpload = vi.fn();
const mockGetResource = vi.fn();
const mockValidateFile = vi.fn();

vi.mock('@/features/file-explorer/hooks/useFileUpload', () => ({
  useFileUpload: () => ({ upload: mockUpload, isUploading: false }),
}));

vi.mock('@ldo/solid-react', () => ({
  useLdo: () => ({ getResource: mockGetResource }),
}));

vi.mock('@/infrastructure/validation/validateFile', () => ({
  validateFile: (...args: unknown[]) => mockValidateFile(...args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  ],
}));

import { useUploadQueue } from '../useUploadQueue-file/useUploadQueue';

const CATALOG_URI = 'https://pod.example/catalog.ttl';
const DESTINATION_URI = 'https://pod.example/photos/';

function makeFile(name: string): File {
  return new File(['x'], name, { type: 'text/plain' });
}

describe('useUploadQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetResource.mockReturnValue({ uri: DESTINATION_URI, children: () => [] });
    mockValidateFile.mockResolvedValue({ valid: true, violations: [], shape: null });
    mockUpload.mockResolvedValue(undefined);
  });

  it('starts with an empty queue', () => {
    const { result } = renderHook(() => useUploadQueue(CATALOG_URI, true, []));
    expect(result.current.items).toEqual([]);
    expect(result.current.hasActive).toBe(false);
  });

  it('does not enqueue anything when enqueueInstant is called with no files', () => {
    const { result } = renderHook(() => useUploadQueue(CATALOG_URI, true, []));
    act(() => {
      result.current.enqueueInstant([], DESTINATION_URI, 'My Drive');
    });
    expect(result.current.items).toEqual([]);
    expect(result.current.hasActive).toBe(false);
  });

  it('enqueues files in queued state, then processes them sequentially to success', async () => {
    const { result } = renderHook(() => useUploadQueue(CATALOG_URI, true, []));
    act(() => {
      result.current.enqueueInstant([makeFile('a.txt'), makeFile('b.txt')], DESTINATION_URI, 'My Drive');
    });
    expect(result.current.items).toHaveLength(2);
    await waitFor(() => expect(result.current.items.every((item) => item.status === 'success')).toBe(true));
    expect(mockUpload).toHaveBeenCalledTimes(2);
  });

  it('marks an item as error when validation fails and does not call upload for it', async () => {
    mockValidateFile.mockImplementation(async (file: File) =>
      file.name === 'bad.txt'
        ? { valid: false, violations: [{ label: 'Title', localName: 'name', path: 'p', description: '', minCount: 1 }], shape: null }
        : { valid: true, violations: [], shape: null }
    );
    const { result } = renderHook(() => useUploadQueue(CATALOG_URI, true, []));
    act(() => {
      result.current.enqueueInstant([makeFile('bad.txt'), makeFile('good.txt')], DESTINATION_URI, 'My Drive');
    });
    await waitFor(() => expect(result.current.items.every((item) => item.status !== 'queued' && item.status !== 'uploading')).toBe(true));
    const bad = result.current.items.find((item) => item.file.name === 'bad.txt');
    const good = result.current.items.find((item) => item.file.name === 'good.txt');
    expect(bad?.status).toBe('error');
    expect(bad?.error).toContain('Title');
    expect(good?.status).toBe('success');
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });

  it('captures upload errors and surfaces them on the row', async () => {
    mockUpload.mockRejectedValueOnce(new Error('403 Forbidden'));
    const { result } = renderHook(() => useUploadQueue(CATALOG_URI, true, []));
    act(() => {
      result.current.enqueueInstant([makeFile('boom.txt')], DESTINATION_URI, 'My Drive');
    });
    await waitFor(() => expect(result.current.items[0].status).toBe('error'));
    expect(result.current.items[0].error).toBe('403 Forbidden');
  });

  it('removes a settled row on dismiss', async () => {
    const { result } = renderHook(() => useUploadQueue(CATALOG_URI, true, []));
    act(() => {
      result.current.enqueueInstant([makeFile('x.txt')], DESTINATION_URI, 'My Drive');
    });
    await waitFor(() => expect(result.current.items[0].status).toBe('success'));
    const dismissedId = result.current.items[0].id;
    act(() => result.current.dismiss(dismissedId));
    expect(result.current.items).toHaveLength(0);
  });

  it('retries an errored item by flipping it back to queued', async () => {
    mockUpload.mockRejectedValueOnce(new Error('temporary')).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useUploadQueue(CATALOG_URI, true, []));
    act(() => {
      result.current.enqueueInstant([makeFile('flap.txt')], DESTINATION_URI, 'My Drive');
    });
    await waitFor(() => expect(result.current.items[0].status).toBe('error'));
    expect(result.current.items).toHaveLength(1);
    const id = result.current.items[0].id;
    act(() => result.current.retry(id));
    await waitFor(() => expect(result.current.items[0].status).toBe('success'));
    expect(result.current.items).toHaveLength(1);
    expect(mockUpload).toHaveBeenCalledTimes(2);
  });

  it('hasActive is true while items are queued or uploading and false when all settle', async () => {
    let resolveUpload: (() => void) | undefined;
    mockUpload.mockReturnValue(new Promise<void>((resolve) => { resolveUpload = () => resolve(); }));
    const { result } = renderHook(() => useUploadQueue(CATALOG_URI, true, []));
    act(() => {
      result.current.enqueueInstant([makeFile('slow.txt')], DESTINATION_URI, 'My Drive');
    });
    await waitFor(() => expect(result.current.hasActive).toBe(true));
    act(() => resolveUpload?.());
    await waitFor(() => expect(result.current.hasActive).toBe(false));
  });

  it('rejects an item with a duplicate filename without calling upload', async () => {
    const existingCatalog = [
      {
        uri: 'https://pod.example/backup/duplicate.txt/index.ttl',
        conformsTo: '',
        title: 'duplicate.txt',
        description: '',
        modified: '',
        publisher: '',
        mediaType: 'text/plain',
        byteSize: 1,
        accessURL: 'https://pod.example/backup/duplicate.txt/duplicate.txt',
      },
    ];
    const { result } = renderHook(() => useUploadQueue(CATALOG_URI, true, existingCatalog));
    act(() => {
      result.current.enqueueInstant([makeFile('duplicate.txt')], DESTINATION_URI, 'My Drive');
    });
    await waitFor(() => expect(result.current.items[0].status).toBe('error'));
    expect(result.current.items[0].error).toContain('fileExplorer.uploadDuplicate');
    expect(result.current.items[0].error).toContain('duplicate.txt');
    expect(result.current.items[0].error).toContain('backup');
    expect(mockUpload).not.toHaveBeenCalled();
  });
});

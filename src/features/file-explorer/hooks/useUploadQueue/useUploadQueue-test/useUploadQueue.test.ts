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

  it('marks an item as error when validation throws (e.g. shape fetch failure)', async () => {
    mockValidateFile.mockRejectedValueOnce(new Error('shape unreachable'));
    const { result } = renderHook(() => useUploadQueue(CATALOG_URI, true, []));
    act(() => {
      result.current.enqueueInstant([makeFile('thrower.txt')], DESTINATION_URI, 'My Drive');
    });
    await waitFor(() => expect(result.current.items[0].status).toBe('error'));
    expect(result.current.items[0].error).toBe('Validation failed');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('marks an item as error when the destination resource is not a container', async () => {
    mockGetResource.mockReturnValue({ uri: 'https://pod.example/photos/notes.txt' });
    const { result } = renderHook(() => useUploadQueue(CATALOG_URI, true, []));
    act(() => {
      result.current.enqueueInstant([makeFile('a.txt')], DESTINATION_URI, 'My Drive');
    });
    await waitFor(() => expect(result.current.items[0].status).toBe('error'));
    expect(result.current.items[0].error).toBe('Destination is not a container');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('rejects a duplicate even when its accessURL has a malformed percent-escape', async () => {
    const existingCatalog = [
      {
        uri: 'https://pod.example/backup/odd%file/index.ttl',
        conformsTo: '',
        title: 'something-else.txt',
        description: '',
        modified: '',
        publisher: '',
        mediaType: 'text/plain',
        byteSize: 1,
        accessURL: 'https://pod.example/backup/%E0%A4%A/odd.txt',
      },
    ];
    const { result } = renderHook(() => useUploadQueue(CATALOG_URI, true, existingCatalog));
    act(() => {
      result.current.enqueueInstant([makeFile('odd.txt')], DESTINATION_URI, 'My Drive');
    });
    await waitFor(() => expect(result.current.items[0].status).toBe('error'));
    expect(result.current.items[0].error).toContain('fileExplorer.uploadDuplicate');
    expect(mockUpload).not.toHaveBeenCalled();
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

/**
 * Concurrency and the race conditions the serial implementation either had or
 * was avoiding. Every test here fails against the previous one-at-a-time drain.
 */
describe('useUploadQueue concurrency', () => {
  /** A promise plus its resolver, so a test can hold an upload open. */
  function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((res) => {
      resolve = res;
    });
    return { promise, resolve };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetResource.mockReturnValue({ uri: DESTINATION_URI, children: () => [] });
    mockValidateFile.mockResolvedValue({ valid: true, violations: [], shape: null });
    mockUpload.mockResolvedValue(undefined);
  });

  it('runs several transfers at once, bounded by the pool', async () => {
    const gates = Array.from({ length: 8 }, deferred);
    let started = 0;
    let active = 0;
    let peak = 0;
    mockUpload.mockImplementation(async () => {
      const gate = gates[started++];
      active++;
      peak = Math.max(peak, active);
      await gate.promise;
      active--;
    });

    const { result } = renderHook(() => useUploadQueue(CATALOG_URI, true, []));
    act(() => {
      result.current.enqueueInstant(
        Array.from({ length: 8 }, (_, index) => makeFile(`concurrent-${index}.txt`)),
        DESTINATION_URI,
        'My Drive',
      );
    });

    // More than one in flight is the whole point; the serial implementation
    // pinned this at 1.
    await waitFor(() => expect(active).toBeGreaterThan(1));
    await waitFor(() => expect(active).toBe(4));
    expect(peak).toBeLessThanOrEqual(4);

    await act(async () => {
      gates.forEach((gate) => gate.resolve());
    });
    await waitFor(() =>
      expect(result.current.items.every((item) => item.status === 'success')).toBe(true),
    );
    expect(mockUpload).toHaveBeenCalledTimes(8);
  });

  it('serialises the catalog write even though transfers overlap', async () => {
    // The catalog is a single shared document, and appendToCatalog bootstraps a
    // missing one with 404 -> PUT empty -> PATCH. Two of those interleaving lose
    // an entry, so the lock has to hold across the whole section.
    const events: string[] = [];
    mockUpload.mockImplementation(async ({ file, withCatalogLock }: {
      file: File;
      withCatalogLock: <T>(section: () => Promise<T>) => Promise<T>;
    }) => {
      expect(typeof withCatalogLock).toBe('function');
      await withCatalogLock(async () => {
        events.push(`enter:${file.name}`);
        await new Promise((resolve) => setTimeout(resolve, 0));
        events.push(`exit:${file.name}`);
      });
    });

    const { result } = renderHook(() => useUploadQueue(CATALOG_URI, true, []));
    act(() => {
      result.current.enqueueInstant(
        ['a.txt', 'b.txt', 'c.txt', 'd.txt'].map(makeFile),
        DESTINATION_URI,
        'My Drive',
      );
    });

    await waitFor(() => expect(events).toHaveLength(8));
    // No section may open while another is open.
    for (let index = 0; index < events.length; index += 2) {
      expect(events[index].startsWith('enter:')).toBe(true);
      expect(events[index + 1]).toBe(events[index].replace('enter:', 'exit:'));
    }
  });

  it('rejects a second file in the same batch that maps to the same container slug', async () => {
    // "a b.txt" and "a-b.txt" both slug to "a-b.txt", and the container is
    // created with createChildAndOverwrite -- so without this the second upload
    // silently overwrites the first. The catalog prop cannot catch it: within a
    // batch it is always at least one upload stale.
    const { result } = renderHook(() => useUploadQueue(CATALOG_URI, true, []));
    act(() => {
      result.current.enqueueInstant(
        [makeFile('a b.txt'), makeFile('a-b.txt')],
        DESTINATION_URI,
        'My Drive',
      );
    });

    await waitFor(() => expect(result.current.items[1].status).toBe('error'));
    expect(result.current.items[1].error).toContain('fileExplorer.uploadDuplicate');
    await waitFor(() => expect(result.current.items[0].status).toBe('success'));
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });

  it('still uploads a same-slug file into a different destination', async () => {
    const { result } = renderHook(() => useUploadQueue(CATALOG_URI, true, []));
    act(() => {
      result.current.enqueueInstant([makeFile('a b.txt')], DESTINATION_URI, 'My Drive');
      result.current.enqueueInstant([makeFile('a-b.txt')], 'https://pod.example/other/', 'Other');
    });

    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(2));
    expect(result.current.items.every((item) => item.status === 'success')).toBe(true);
  });

  it('picks up a retry issued while other transfers are still running', async () => {
    // Regression: the serial drain remembered handled ids for the lifetime of
    // the drain and only restarted from a React effect, so an item retried
    // mid-drain was skipped and then never rescheduled -- stranded in "queued".
    const gate = deferred();
    mockUpload
      .mockRejectedValueOnce(new Error('transient'))
      .mockImplementationOnce(async () => {
        await gate.promise;
      })
      .mockResolvedValue(undefined);

    const { result } = renderHook(() => useUploadQueue(CATALOG_URI, true, []));
    act(() => {
      result.current.enqueueInstant(
        [makeFile('fails-first.txt'), makeFile('slow.txt')],
        DESTINATION_URI,
        'My Drive',
      );
    });

    await waitFor(() => expect(result.current.items[0].status).toBe('error'));
    expect(result.current.items[1].status).toBe('uploading');

    // Retry while the second transfer is still in flight.
    act(() => {
      result.current.retry(result.current.items[0].id);
    });
    await waitFor(() => expect(result.current.items[0].status).toBe('success'));

    await act(async () => {
      gate.resolve();
    });
    await waitFor(() =>
      expect(result.current.items.every((item) => item.status === 'success')).toBe(true),
    );
  });

  it('picks up files enqueued while a transfer is already running', async () => {
    const gate = deferred();
    mockUpload.mockImplementationOnce(async () => {
      await gate.promise;
    });

    const { result } = renderHook(() => useUploadQueue(CATALOG_URI, true, []));
    act(() => {
      result.current.enqueueInstant([makeFile('first.txt')], DESTINATION_URI, 'My Drive');
    });
    await waitFor(() => expect(result.current.items[0].status).toBe('uploading'));

    act(() => {
      result.current.enqueueInstant([makeFile('second.txt')], DESTINATION_URI, 'My Drive');
    });
    await waitFor(() => expect(result.current.items[1].status).toBe('success'));

    await act(async () => {
      gate.resolve();
    });
    await waitFor(() => expect(result.current.items[0].status).toBe('success'));
  });

  it('does not restart an item that is still in flight when retry is called', async () => {
    const gate = deferred();
    mockUpload.mockImplementation(async () => {
      await gate.promise;
    });

    const { result } = renderHook(() => useUploadQueue(CATALOG_URI, true, []));
    act(() => {
      result.current.enqueueInstant([makeFile('running.txt')], DESTINATION_URI, 'My Drive');
    });
    await waitFor(() => expect(result.current.items[0].status).toBe('uploading'));

    act(() => {
      result.current.retry(result.current.items[0].id);
    });
    await act(async () => {
      gate.resolve();
    });

    await waitFor(() => expect(result.current.items[0].status).toBe('success'));
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });
});

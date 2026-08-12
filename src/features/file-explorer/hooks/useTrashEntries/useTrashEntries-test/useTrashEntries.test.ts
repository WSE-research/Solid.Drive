import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { buildTombstoneTurtle, type Tombstone } from '@/infrastructure/solid/tombstone';
import type { CatalogEntry } from '@/types/catalog';

const mockWebId = 'https://owner.example/#me';
let currentWebId: string | undefined = mockWebId;
const mockFetch = vi.fn();
vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ session: { webId: currentWebId }, fetch: mockFetch }),
}));

const mockUseCatalog = vi.fn();
vi.mock('@/features/file-explorer/hooks/useCatalog', () => ({
  useCatalog: (...args: unknown[]) => mockUseCatalog(...args),
}));

const mockNotifyCatalogChanged = vi.fn();
vi.mock('@/shared/hooks/useCatalogVersion', () => ({
  notifyCatalogChanged: (...args: unknown[]) => mockNotifyCatalogChanged(...args),
}));

const mockDeleteResource = vi.fn().mockResolvedValue({ ok: true });
vi.mock('@/features/file-explorer/services/deleteResource', () => ({
  deleteResource: (...args: unknown[]) => mockDeleteResource(...args),
}));

const mockRestoreTrashedFile = vi.fn().mockResolvedValue({ ok: true, restoredContainerUri: 'x', aclRestored: true });
vi.mock('@/features/file-explorer/services/restoreTrashedFile', () => ({
  restoreTrashedFile: (...args: unknown[]) => mockRestoreTrashedFile(...args),
}));

import { useTrashEntries } from '../useTrashEntries-file/useTrashEntries';

const storageRootUri = 'https://pod.example/';
const trashCatalogUri = 'https://pod.example/trash/catalog.ttl';

function trashRow(id: string): CatalogEntry {
  const containerUri = `https://pod.example/trash/${id}/`;
  return {
    uri: `${containerUri}index.ttl`,
    conformsTo: 'http://schema.org/ImageObject',
    title: id,
    description: '',
    modified: '2026-01-01T00:00:00.000Z',
    publisher: mockWebId,
    mediaType: 'image/jpeg',
    byteSize: 100,
    accessURL: `${containerUri}photo.jpg`,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const FUTURE_EXPIRY = new Date(Date.now() + 30 * DAY_MS).toISOString();
const PAST_EXPIRY = new Date(Date.now() - 1 * DAY_MS).toISOString();

function tombstoneFor(id: string, expiresAt: string): Tombstone {
  return {
    originalContainerUri: `https://pod.example/my-solid-app/${id}-original/`,
    originalCatalogUri: 'https://pod.example/catalog.ttl',
    originalInstanceUri: `https://pod.example/my-solid-app/${id}-original/index.ttl`,
    originalBinaryName: 'photo.jpg',
    originalClassUri: 'http://schema.org/ImageObject',
    hasAclSnapshot: true,
    deletedAt: '2026-01-01T00:00:00.000Z',
    expiresAt,
  };
}

describe('useTrashEntries', () => {
  beforeEach(() => {
    currentWebId = mockWebId;
    mockUseCatalog.mockReset().mockReturnValue({ entries: [], loading: false, error: null });
    mockNotifyCatalogChanged.mockClear();
    mockDeleteResource.mockClear().mockResolvedValue({ ok: true });
    mockRestoreTrashedFile.mockClear().mockResolvedValue({ ok: true, restoredContainerUri: 'x', aclRestored: true });
    mockFetch.mockReset().mockResolvedValue(new Response('', { status: 404 }));
  });

  it('requests the trash catalog via useCatalog', () => {
    renderHook(() => useTrashEntries(storageRootUri));
    expect(mockUseCatalog).toHaveBeenCalledWith(trashCatalogUri);
  });

  it('returns no entries and fetches nothing when the user\'s storage location is not known yet', () => {
    const { result } = renderHook(() => useTrashEntries(undefined));
    expect(mockUseCatalog).toHaveBeenCalledWith(undefined);
    expect(result.current.entries).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('turns a live catalog row into a TrashEntry with its container URI and tombstone', async () => {
    const row = trashRow('photo-abc');
    const tombstone = tombstoneFor('photo-abc', FUTURE_EXPIRY);
    mockUseCatalog.mockReturnValue({ entries: [row], loading: false, error: null });
    mockFetch.mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith('tombstone.ttl')) return new Response(buildTombstoneTurtle(url, tombstone), { status: 200 });
      return new Response('', { status: 404 });
    });

    const { result } = renderHook(() => useTrashEntries(storageRootUri));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));

    expect(result.current.entries[0]).toEqual({
      entry: {
        metadataUri: row.uri,
        binaryUri: row.accessURL,
        classUri: row.conformsTo,
        mediaType: row.mediaType,
        byteSize: row.byteSize,
        title: row.title,
        description: row.description,
        modified: row.modified,
      },
      containerUri: 'https://pod.example/trash/photo-abc/',
      tombstone,
    });
  });

  it('purges an expired entry and removes it from the returned entries', async () => {
    const row = trashRow('old-photo');
    const tombstone = tombstoneFor('old-photo', PAST_EXPIRY);
    mockUseCatalog.mockReturnValue({ entries: [row], loading: false, error: null });
    mockFetch.mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith('tombstone.ttl')) return new Response(buildTombstoneTurtle(url, tombstone), { status: 200 });
      return new Response('', { status: 404 });
    });

    const { result } = renderHook(() => useTrashEntries(storageRootUri));
    await waitFor(() => expect(mockDeleteResource).toHaveBeenCalledTimes(1));

    expect(mockDeleteResource).toHaveBeenCalledWith({
      containerUri: 'https://pod.example/trash/old-photo/',
      fetch: mockFetch,
      catalogUri: trashCatalogUri,
      metadataUri: row.uri,
    });
    await waitFor(() => expect(result.current.entries).toEqual([]));
    expect(mockNotifyCatalogChanged).toHaveBeenCalledWith(trashCatalogUri);
  });

  it('triggers a single update, not one per item, after purging a batch of expired entries', async () => {
    const rows = [trashRow('old-1'), trashRow('old-2')];
    mockUseCatalog.mockReturnValue({ entries: rows, loading: false, error: null });
    mockFetch.mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes('old-1') && url.endsWith('tombstone.ttl')) {
        return new Response(buildTombstoneTurtle(url, tombstoneFor('old-1', PAST_EXPIRY)), { status: 200 });
      }
      if (url.includes('old-2') && url.endsWith('tombstone.ttl')) {
        return new Response(buildTombstoneTurtle(url, tombstoneFor('old-2', PAST_EXPIRY)), { status: 200 });
      }
      return new Response('', { status: 404 });
    });

    renderHook(() => useTrashEntries(storageRootUri));
    await waitFor(() => expect(mockDeleteResource).toHaveBeenCalledTimes(2));
    expect(mockNotifyCatalogChanged).toHaveBeenCalledTimes(1);
  });

  it('keeps an expired entry visible when its hard-delete fails, instead of silently hiding it', async () => {
    const row = trashRow('undeletable');
    const tombstone = tombstoneFor('undeletable', PAST_EXPIRY);
    mockUseCatalog.mockReturnValue({ entries: [row], loading: false, error: null });
    mockFetch.mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith('tombstone.ttl')) return new Response(buildTombstoneTurtle(url, tombstone), { status: 200 });
      return new Response('', { status: 404 });
    });
    mockDeleteResource.mockResolvedValue({ ok: false, reason: '403 Forbidden' });

    const { result } = renderHook(() => useTrashEntries(storageRootUri));
    await waitFor(() => expect(mockDeleteResource).toHaveBeenCalledTimes(1));

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].containerUri).toBe('https://pod.example/trash/undeletable/');
  });

  it('purges expired entries in parallel, not one at a time', async () => {
    const rows = [trashRow('old-1'), trashRow('old-2')];
    mockUseCatalog.mockReturnValue({ entries: rows, loading: false, error: null });
    mockFetch.mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes('old-1') && url.endsWith('tombstone.ttl')) {
        return new Response(buildTombstoneTurtle(url, tombstoneFor('old-1', PAST_EXPIRY)), { status: 200 });
      }
      if (url.includes('old-2') && url.endsWith('tombstone.ttl')) {
        return new Response(buildTombstoneTurtle(url, tombstoneFor('old-2', PAST_EXPIRY)), { status: 200 });
      }
      return new Response('', { status: 404 });
    });

    let resolveFirst: (() => void) | undefined;
    let secondCallStartedBeforeFirstResolved = false;
    let firstCallStarted = false;
    mockDeleteResource.mockImplementation(() => {
      if (firstCallStarted) {
        secondCallStartedBeforeFirstResolved = true;
        return Promise.resolve({ ok: true });
      }
      firstCallStarted = true;
      return new Promise((resolve) => {
        resolveFirst = () => resolve({ ok: true });
      });
    });

    renderHook(() => useTrashEntries(storageRootUri));
    await waitFor(() => expect(resolveFirst).toBeDefined());
    expect(secondCallStartedBeforeFirstResolved).toBe(true);
    resolveFirst?.();
  });

  it('surfaces a caught error instead of leaving entries stuck when processing trash rows throws', async () => {
    const row = trashRow('broken');
    mockUseCatalog.mockReturnValue({ entries: [row], loading: false, error: null });
    mockFetch.mockRejectedValue(new Error('network down'));
    mockDeleteResource.mockImplementation(() => {
      throw new Error('unexpected throw');
    });
    const tombstone = tombstoneFor('broken', PAST_EXPIRY);
    mockFetch.mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith('tombstone.ttl')) return new Response(buildTombstoneTurtle(url, tombstone), { status: 200 });
      return new Response('', { status: 404 });
    });

    const { result } = renderHook(() => useTrashEntries(storageRootUri));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe('unexpected throw');
  });

  it('keeps an entry with a missing tombstone visible, with tombstone: null', async () => {
    const row = trashRow('no-tombstone');
    mockUseCatalog.mockReturnValue({ entries: [row], loading: false, error: null });
    mockFetch.mockResolvedValue(new Response('', { status: 404 }));

    const { result } = renderHook(() => useTrashEntries(storageRootUri));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.entries[0].tombstone).toBeNull();
    expect(mockDeleteResource).not.toHaveBeenCalled();
  });

  it('avoids re-checking tombstones again when the same catalog rows come back unchanged', async () => {
    const rows = [trashRow('stable')];
    const tombstone = tombstoneFor('stable', FUTURE_EXPIRY);
    mockUseCatalog.mockReturnValue({ entries: rows, loading: false, error: null });
    mockFetch.mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith('tombstone.ttl')) return new Response(buildTombstoneTurtle(url, tombstone), { status: 200 });
      return new Response('', { status: 404 });
    });

    const { result, rerender } = renderHook(() => useTrashEntries(storageRootUri));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    const fetchCountAfterFirst = mockFetch.mock.calls.length;

    rerender();
    await Promise.resolve();
    expect(mockFetch.mock.calls.length).toBe(fetchCountAfterFirst);
  });

  it('purge() permanently deletes the item, removing its files and its trash catalog entry', async () => {
    const { result } = renderHook(() => useTrashEntries(storageRootUri));
    const item = {
      entry: { metadataUri: 'x/index.ttl', binaryUri: 'x/photo.jpg', classUri: '', mediaType: '', byteSize: 0, title: '', description: '', modified: '' },
      containerUri: 'https://pod.example/trash/x/',
      tombstone: null,
    };

    await result.current.purge(item);

    expect(mockDeleteResource).toHaveBeenCalledWith({
      containerUri: item.containerUri,
      fetch: mockFetch,
      catalogUri: trashCatalogUri,
      metadataUri: item.entry.metadataUri,
    });
  });

  it('restore() sends the current user\'s storage location and identity to put the file back', async () => {
    const { result } = renderHook(() => useTrashEntries(storageRootUri));
    const item = {
      entry: { metadataUri: 'x/index.ttl', binaryUri: 'x/photo.jpg', classUri: '', mediaType: '', byteSize: 0, title: '', description: '', modified: '' },
      containerUri: 'https://pod.example/trash/x/',
      tombstone: null,
    };

    await result.current.restore(item);

    expect(mockRestoreTrashedFile).toHaveBeenCalledWith({
      trashItemContainerUri: item.containerUri,
      storageRootUri,
      entry: item.entry,
      ownerWebId: mockWebId,
      fetch: mockFetch,
    });
  });

  it('restore() fails immediately when no user is logged in', async () => {
    currentWebId = undefined;
    const { result } = renderHook(() => useTrashEntries(storageRootUri));
    const item = {
      entry: { metadataUri: 'x/index.ttl', binaryUri: 'x/photo.jpg', classUri: '', mediaType: '', byteSize: 0, title: '', description: '', modified: '' },
      containerUri: 'https://pod.example/trash/x/',
      tombstone: null,
    };

    const outcome = await result.current.restore(item);

    expect(outcome).toEqual({ ok: false, reason: 'failed', detail: 'Not logged in' });
    expect(mockRestoreTrashedFile).not.toHaveBeenCalled();
  });

  it('ignores results after unmount but still purges and notifies once for work already in flight', async () => {
    const row = trashRow('unmounting');
    const tombstone = tombstoneFor('unmounting', PAST_EXPIRY);
    mockUseCatalog.mockReturnValue({ entries: [row], loading: false, error: null });
    let resolveTombstoneFetch: ((response: Response) => void) | undefined;
    mockFetch.mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith('tombstone.ttl')) {
        return new Promise<Response>((resolve) => {
          resolveTombstoneFetch = resolve;
        });
      }
      return new Response('', { status: 404 });
    });

    const { result, unmount } = renderHook(() => useTrashEntries(storageRootUri));
    await waitFor(() => expect(resolveTombstoneFetch).toBeDefined());
    unmount();
    resolveTombstoneFetch?.(new Response(buildTombstoneTurtle('x', tombstone), { status: 200 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.entries).toEqual([]);
    expect(mockDeleteResource).not.toHaveBeenCalled();
    expect(mockNotifyCatalogChanged).not.toHaveBeenCalled();
  });

  it('restore() fails immediately when the user\'s storage location is not known yet', async () => {
    const { result } = renderHook(() => useTrashEntries(undefined));
    const item = {
      entry: { metadataUri: 'x/index.ttl', binaryUri: 'x/photo.jpg', classUri: '', mediaType: '', byteSize: 0, title: '', description: '', modified: '' },
      containerUri: 'https://pod.example/trash/x/',
      tombstone: null,
    };

    const outcome = await result.current.restore(item);

    expect(outcome).toEqual({ ok: false, reason: 'failed', detail: 'No storage root resolved yet' });
    expect(mockRestoreTrashedFile).not.toHaveBeenCalled();
  });

  it('reflects the trash catalog\'s loading and error state', () => {
    const boom = new Error('boom');
    mockUseCatalog.mockReturnValue({ entries: [], loading: true, error: boom });
    const { result } = renderHook(() => useTrashEntries(storageRootUri));
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(boom);
  });
});

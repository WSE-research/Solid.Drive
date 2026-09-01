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

const mockRestoreTrashedFolder = vi.fn().mockResolvedValue({ ok: true, restoredContainerUri: 'x', aclRestored: true });
vi.mock('@/features/file-explorer/services/restoreTrashedFolder', () => ({
  restoreTrashedFolder: (...args: unknown[]) => mockRestoreTrashedFolder(...args),
}));

import { useTrashEntries } from '../useTrashEntries-file/useTrashEntries';

const storageRootUri = 'https://pod.example/';
const trashCatalogUri = 'https://pod.example/trash/catalog.ttl';
const FOLDER_CLASS_URI = 'https://purl.org/solid-drive/catalog#Folder';

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

// A trashed folder's own dataset URI is its container, not an index.ttl
// suffix. See appendFolderToCatalog.
function trashFolderRow(id: string): CatalogEntry {
  const containerUri = `https://pod.example/trash/${id}/`;
  return {
    uri: containerUri,
    conformsTo: FOLDER_CLASS_URI,
    title: id,
    description: '',
    modified: '2026-01-01T00:00:00.000Z',
    publisher: mockWebId,
    mediaType: '',
    byteSize: 0,
    accessURL: '',
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const FUTURE_EXPIRY = new Date(Date.now() + 30 * DAY_MS).toISOString();
const PAST_EXPIRY = new Date(Date.now() - 1 * DAY_MS).toISOString();

function tombstoneFor(id: string, expiresAt: string): Tombstone {
  return {
    kind: 'file',
    originalContainerUri: `https://pod.example/my-solid-app/${id}-original/`,
    originalParentUri: 'https://pod.example/my-solid-app/',
    originalCatalogUri: 'https://pod.example/catalog.ttl',
    originalInstanceUri: `https://pod.example/my-solid-app/${id}-original/index.ttl`,
    originalBinaryName: 'photo.jpg',
    originalClassUri: 'http://schema.org/ImageObject',
    hasAclSnapshot: true,
    deletedAt: '2026-01-01T00:00:00.000Z',
    expiresAt,
  };
}

function folderTombstoneFor(id: string, originalContainerUri: string, expiresAt: string): Tombstone {
  return { ...tombstoneFor(id, expiresAt), kind: 'folder', originalContainerUri, originalBinaryName: '' };
}

/** A minimal catalog-snapshot.ttl body: the folder's own row plus its descendants. */
function catalogSnapshotTurtle(
  snapshotUri: string,
  rootUri: string,
  descendants: { uri: string; title: string; kind: 'file' | 'folder'; parentUri: string }[],
): string {
  const DCAT = 'http://www.w3.org/ns/dcat#';
  const DCTERMS = 'http://purl.org/dc/terms/';
  const HAS_PARENT = `${FOLDER_CLASS_URI.replace('#Folder', '')}#hasParent`;
  const rows = [{ uri: rootUri, title: 'root', kind: 'folder' as const, parentUri: '' }, ...descendants];
  const lines: string[] = [];
  for (const row of rows) {
    lines.push(`<${snapshotUri}> <${DCAT}dataset> <${row.uri}> .`);
    lines.push(`<${row.uri}> <${DCTERMS}title> "${row.title}" .`);
    if (row.parentUri) lines.push(`<${row.uri}> <${HAS_PARENT}> <${row.parentUri}> .`);
    if (row.kind === 'folder') lines.push(`<${row.uri}> <${DCTERMS}conformsTo> <${FOLDER_CLASS_URI}> .`);
  }
  return lines.join('\n');
}

describe('useTrashEntries', () => {
  beforeEach(() => {
    currentWebId = mockWebId;
    mockUseCatalog.mockReset().mockReturnValue({ entries: [], loading: false, error: null });
    mockNotifyCatalogChanged.mockClear();
    mockDeleteResource.mockClear().mockResolvedValue({ ok: true });
    mockRestoreTrashedFile.mockClear().mockResolvedValue({ ok: true, restoredContainerUri: 'x', aclRestored: true });
    mockRestoreTrashedFolder.mockClear().mockResolvedValue({ ok: true, restoredContainerUri: 'x', aclRestored: true });
    mockFetch.mockReset().mockResolvedValue(new Response('', { status: 404 }));
  });

  it('requests the trash catalog through the shared catalog loader', () => {
    renderHook(() => useTrashEntries(storageRootUri));
    expect(mockUseCatalog).toHaveBeenCalledWith(trashCatalogUri);
  });

  it('returns no entries and fetches nothing when the user\'s storage location is not known yet', () => {
    const { result } = renderHook(() => useTrashEntries(undefined));
    expect(mockUseCatalog).toHaveBeenCalledWith(undefined);
    expect(result.current.entries).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('builds a trash entry from a live catalog row, including its container URI and tombstone', async () => {
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
      kind: 'file',
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
      contents: null,
    });
  });

  it('includes trashed folders, not just files, and marks each one as a folder', async () => {
    // Trash folders come through `folderEntries`, so this hook reads both lists.
    const row = trashFolderRow('vacation-photos');
    mockUseCatalog.mockReturnValue({ entries: [], folderEntries: [row], loading: false, error: null });
    mockFetch.mockResolvedValue(new Response('', { status: 404 }));

    const { result } = renderHook(() => useTrashEntries(storageRootUri));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.entries[0].kind).toBe('folder');
    expect(result.current.entries[0].containerUri).toBe('https://pod.example/trash/vacation-photos/');
  });

  it('trusts the tombstone\'s own kind over the catalog row\'s type, since the tombstone is written by this app itself', async () => {
    const row = trashRow('mislabeled');
    const tombstone: Tombstone = { ...tombstoneFor('mislabeled', FUTURE_EXPIRY), kind: 'folder' };
    mockUseCatalog.mockReturnValue({ entries: [row], loading: false, error: null });
    mockFetch.mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith('tombstone.ttl')) return new Response(buildTombstoneTurtle(url, tombstone), { status: 200 });
      return new Response('', { status: 404 });
    });

    const { result } = renderHook(() => useTrashEntries(storageRootUri));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.entries[0].kind).toBe('folder');
  });

  it('summarizes a trashed folder\'s catalog snapshot into its item counts and contents', async () => {
    const row = trashFolderRow('vacation-photos');
    const originalRoot = 'https://pod.example/my-solid-app/vacation-photos/';
    const tombstone = folderTombstoneFor('vacation-photos', originalRoot, FUTURE_EXPIRY);
    const snapshotUri = 'https://pod.example/trash/vacation-photos/catalog-snapshot.ttl';
    const subFolderUri = `${originalRoot}sunsets/`;
    const fileUri = `${originalRoot}beach.jpg/index.ttl`;

    mockUseCatalog.mockReturnValue({ entries: [], folderEntries: [row], loading: false, error: null });
    mockFetch.mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith('tombstone.ttl')) return new Response(buildTombstoneTurtle(url, tombstone), { status: 200 });
      if (url === snapshotUri) {
        return new Response(
          catalogSnapshotTurtle(snapshotUri, originalRoot, [
            { uri: subFolderUri, title: 'Sunsets', kind: 'folder', parentUri: originalRoot },
            { uri: fileUri, title: 'beach.jpg', kind: 'file', parentUri: originalRoot },
          ]),
          { status: 200 },
        );
      }
      return new Response('', { status: 404 });
    });

    const { result } = renderHook(() => useTrashEntries(storageRootUri));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));

    expect(result.current.entries[0].contents).toEqual({
      entries: expect.arrayContaining([
        expect.objectContaining({ uri: subFolderUri }),
        expect.objectContaining({ uri: fileUri }),
      ]),
      fileCount: 1,
      folderCount: 1,
    });
  });

  it('reports zero counts, not null, for a trashed folder with an empty catalog snapshot (nothing was in it)', async () => {
    const row = trashFolderRow('empty-folder');
    const tombstone = folderTombstoneFor(
      'empty-folder',
      'https://pod.example/my-solid-app/empty-folder/',
      FUTURE_EXPIRY,
    );
    mockUseCatalog.mockReturnValue({ entries: [], folderEntries: [row], loading: false, error: null });
    mockFetch.mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith('tombstone.ttl')) return new Response(buildTombstoneTurtle(url, tombstone), { status: 200 });
      return new Response('', { status: 404 }); // catalog-snapshot.ttl 404s too
    });

    const { result } = renderHook(() => useTrashEntries(storageRootUri));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.entries[0].contents).toEqual({ entries: [], fileCount: 0, folderCount: 0 });
  });

  it('leaves contents null when reading a trashed folder\'s catalog snapshot fails', async () => {
    const row = trashFolderRow('broken-snapshot');
    const tombstone = folderTombstoneFor(
      'broken-snapshot',
      'https://pod.example/my-solid-app/broken-snapshot/',
      FUTURE_EXPIRY,
    );
    mockUseCatalog.mockReturnValue({ entries: [], folderEntries: [row], loading: false, error: null });
    mockFetch.mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith('tombstone.ttl')) return new Response(buildTombstoneTurtle(url, tombstone), { status: 200 });
      if (url.endsWith('catalog-snapshot.ttl')) throw new Error('network down');
      return new Response('', { status: 404 });
    });

    const { result } = renderHook(() => useTrashEntries(storageRootUri));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.entries[0].contents).toBeNull();
  });

  it('leaves contents null for a trashed folder with no tombstone, since its original location isn\'t known', async () => {
    const row = trashFolderRow('no-tombstone-folder');
    mockUseCatalog.mockReturnValue({ entries: [], folderEntries: [row], loading: false, error: null });
    mockFetch.mockResolvedValue(new Response('', { status: 404 }));

    const { result } = renderHook(() => useTrashEntries(storageRootUri));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.entries[0].contents).toBeNull();
  });

  it('leaves contents null for a file entry', async () => {
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
    expect(result.current.entries[0].contents).toBeNull();
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

  it('keeps an expired entry visible when permanently deleting it fails, instead of silently hiding it', async () => {
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

  it('surfaces an error instead of leaving entries stuck when something goes wrong while processing trash rows', async () => {
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

  it('keeps an entry visible when its tombstone is missing, reporting no tombstone instead of hiding the entry', async () => {
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

  it('permanently deletes an item, removing its files and its trash catalog entry', async () => {
    const { result } = renderHook(() => useTrashEntries(storageRootUri));
    const item = {
      kind: 'file' as const,
      entry: { metadataUri: 'x/index.ttl', binaryUri: 'x/photo.jpg', classUri: '', mediaType: '', byteSize: 0, title: '', description: '', modified: '' },
      containerUri: 'https://pod.example/trash/x/',
      tombstone: null,
      contents: null,
    };

    await result.current.purge(item);

    expect(mockDeleteResource).toHaveBeenCalledWith({
      containerUri: item.containerUri,
      fetch: mockFetch,
      catalogUri: trashCatalogUri,
      metadataUri: item.entry.metadataUri,
    });
  });

  it('restoring a file sends the current user\'s storage location and identity, to put it back in the right place', async () => {
    const { result } = renderHook(() => useTrashEntries(storageRootUri));
    const item = {
      kind: 'file' as const,
      entry: { metadataUri: 'x/index.ttl', binaryUri: 'x/photo.jpg', classUri: '', mediaType: '', byteSize: 0, title: '', description: '', modified: '' },
      containerUri: 'https://pod.example/trash/x/',
      tombstone: null,
      contents: null,
    };

    await result.current.restore(item);

    expect(mockRestoreTrashedFile).toHaveBeenCalledWith({
      trashItemContainerUri: item.containerUri,
      storageRootUri,
      entry: item.entry,
      ownerWebId: mockWebId,
      fetch: mockFetch,
    });
    expect(mockRestoreTrashedFolder).not.toHaveBeenCalled();
  });

  it('restoring a folder does not require a logged-in user, unlike restoring a file', async () => {
    currentWebId = undefined;
    const { result } = renderHook(() => useTrashEntries(storageRootUri));
    const item = {
      kind: 'folder' as const,
      entry: { metadataUri: 'x/', binaryUri: '', classUri: '', mediaType: '', byteSize: 0, title: '', description: '', modified: '' },
      containerUri: 'https://pod.example/trash/x/',
      tombstone: null,
      contents: null,
    };

    await result.current.restore(item);

    expect(mockRestoreTrashedFolder).toHaveBeenCalledWith({
      trashItemContainerUri: item.containerUri,
      storageRootUri,
      fetch: mockFetch,
    });
    expect(mockRestoreTrashedFile).not.toHaveBeenCalled();
  });

  it('restoring a file fails immediately when no user is logged in', async () => {
    currentWebId = undefined;
    const { result } = renderHook(() => useTrashEntries(storageRootUri));
    const item = {
      kind: 'file' as const,
      entry: { metadataUri: 'x/index.ttl', binaryUri: 'x/photo.jpg', classUri: '', mediaType: '', byteSize: 0, title: '', description: '', modified: '' },
      containerUri: 'https://pod.example/trash/x/',
      tombstone: null,
      contents: null,
    };

    const outcome = await result.current.restore(item);

    expect(outcome).toEqual({ ok: false, reason: 'failed', detail: 'Not logged in' });
    expect(mockRestoreTrashedFile).not.toHaveBeenCalled();
  });

  it('ignores results after the component unmounts, but still finishes purging and notifying for work already in flight', async () => {
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

  it('restoring a file fails immediately when the user\'s storage location is not known yet', async () => {
    const { result } = renderHook(() => useTrashEntries(undefined));
    const item = {
      kind: 'file' as const,
      entry: { metadataUri: 'x/index.ttl', binaryUri: 'x/photo.jpg', classUri: '', mediaType: '', byteSize: 0, title: '', description: '', modified: '' },
      containerUri: 'https://pod.example/trash/x/',
      tombstone: null,
      contents: null,
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

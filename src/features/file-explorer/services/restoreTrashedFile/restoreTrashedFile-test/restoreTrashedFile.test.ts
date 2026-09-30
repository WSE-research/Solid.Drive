import { describe, it, expect, vi, beforeEach } from 'vitest';
import { restoreTrashedFile } from '../restoreTrashedFile-file/restoreTrashedFile';
import { buildTombstoneTurtle, type Tombstone } from '@/infrastructure/solid/tombstone';
import type { FetchFn } from '@/types/solid';
import type { SharedEntry } from '@/types/sharing';

const mockAppendToCatalog = vi.fn().mockResolvedValue(undefined);
vi.mock('@/infrastructure/solid/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infrastructure/solid/catalog')>();
  return { ...actual, appendToCatalog: (...args: unknown[]) => mockAppendToCatalog(...args) };
});

const mockRestoreAclFromSnapshot = vi.fn().mockResolvedValue(true);
vi.mock('@/infrastructure/wac/aclSnapshot', () => ({
  restoreAclFromSnapshot: (...args: unknown[]) => mockRestoreAclFromSnapshot(...args),
}));

const mockDeleteResource = vi.fn().mockResolvedValue({ ok: true });
vi.mock('@/features/file-explorer/services/deleteResource', () => ({
  deleteResource: (...args: unknown[]) => mockDeleteResource(...args),
  deleteResourceQuietly: (...args: unknown[]) => mockDeleteResource(...args).catch(() => {}),
}));

const mockNotifyCatalogChanged = vi.fn();
vi.mock('@/shared/hooks/useCatalogVersion', () => ({
  notifyCatalogChanged: (...args: unknown[]) => mockNotifyCatalogChanged(...args),
}));

const mockNotifyAclChanged = vi.fn();
vi.mock('@/shared/hooks/useAclVersion', () => ({
  notifyAclChanged: (...args: unknown[]) => mockNotifyAclChanged(...args),
}));

const mockSoftDeleteFile = vi.fn().mockResolvedValue({ ok: true, trashItemContainerUri: 'https://pod.example/trash/occupant/' });
vi.mock('@/features/file-explorer/services/softDeleteFile', () => ({
  softDeleteFile: (...args: unknown[]) => mockSoftDeleteFile(...args),
}));

const trashItemContainerUri = 'https://pod.example/trash/abc123/';
const tombstoneUri = `${trashItemContainerUri}tombstone.ttl`;
const trashPayloadUri = `${trashItemContainerUri}payload`;
const storageRootUri = 'https://pod.example/';
const originalContainerUri = 'https://pod.example/my-solid-app/photo-2024/';
const ownerWebId = 'https://owner.example/#me';

const baseTombstone: Tombstone = {
  kind: 'file',
  originalContainerUri,
  originalParentUri: 'https://pod.example/my-solid-app/',
  originalCatalogUri: 'https://pod.example/catalog.ttl',
  originalInstanceUri: `${originalContainerUri}index.ttl`,
  originalBinaryName: 'photo.jpg',
  originalClassUri: 'http://schema.org/ImageObject',
  hasAclSnapshot: true,
  deletedAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-01-31T00:00:00.000Z',
};

const trashEntry: SharedEntry = {
  metadataUri: `${trashItemContainerUri}index.ttl`,
  binaryUri: trashPayloadUri,
  classUri: 'http://schema.org/ImageObject',
  mediaType: 'image/jpeg',
  byteSize: 12345,
  title: 'photo',
  description: 'a photo',
  modified: '2026-01-01T00:00:00.000Z',
};

function okResponse(body = '', contentType?: string): Response {
  return new Response(body, { status: 200, headers: contentType ? { 'Content-Type': contentType } : undefined });
}

function errorResponse(status: number, statusText: string): Response {
  return new Response('', { status, statusText });
}

function makeFetch(overrides: Record<string, Response> = {}, tombstone: Tombstone | null = baseTombstone) {
  return vi.fn<FetchFn>(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const key = `${method} ${url}`;
    if (overrides[key]) return overrides[key];
    if (overrides[url]) return overrides[url];
    if (url === tombstoneUri) {
      return tombstone ? okResponse(buildTombstoneTurtle(tombstoneUri, tombstone), 'text/turtle') : errorResponse(404, 'Not Found');
    }
    if (method === 'HEAD' && url === `${originalContainerUri}index.ttl`) return errorResponse(404, 'Not Found');
    if (method === 'PUT') return okResponse('', undefined);
    if (url === trashPayloadUri) return okResponse('binary-data', 'image/jpeg');
    if (url === `${trashItemContainerUri}index.ttl`) return okResponse('<> a <#Dataset> .', 'text/turtle');
    return errorResponse(404, 'Not Found');
  });
}

function restoreArgs(overrides: Partial<Parameters<typeof restoreTrashedFile>[0]> = {}) {
  return {
    trashItemContainerUri,
    storageRootUri,
    entry: trashEntry,
    ownerWebId,
    fetch: makeFetch(),
    ...overrides,
  };
}

describe('restoreTrashedFile', () => {
  beforeEach(() => {
    mockAppendToCatalog.mockClear().mockResolvedValue(undefined);
    mockRestoreAclFromSnapshot.mockClear().mockResolvedValue(true);
    mockDeleteResource.mockClear().mockResolvedValue({ ok: true });
    mockNotifyCatalogChanged.mockClear();
    mockNotifyAclChanged.mockClear();
    mockSoftDeleteFile.mockClear().mockResolvedValue({ ok: true, trashItemContainerUri: 'https://pod.example/trash/occupant/' });
  });

  it('restores the file to its original location and returns aclRestored: true', async () => {
    const result = await restoreTrashedFile(restoreArgs());
    expect(result).toEqual({ ok: true, restoredContainerUri: originalContainerUri, aclRestored: true });
  });

  it('copies the binary and index.ttl from the trash item to the original location', async () => {
    const fetchFn = makeFetch();
    await restoreTrashedFile(restoreArgs({ fetch: fetchFn }));

    const puts = fetchFn.mock.calls
      .filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
      .map(([url]) => String(url));
    expect(puts).toContain(`${originalContainerUri}photo.jpg`);
    expect(puts).toContain(`${originalContainerUri}index.ttl`);
  });

  it('restores the ACL from the snapshot when the tombstone says one was captured', async () => {
    await restoreTrashedFile(restoreArgs());
    expect(mockRestoreAclFromSnapshot).toHaveBeenCalledWith(
      `${trashItemContainerUri}acl-snapshot.ttl`,
      originalContainerUri,
      expect.any(Function),
    );
  });

  it('skips ACL restore and reports aclRestored: false when the tombstone says none was captured', async () => {
    const tombstone = { ...baseTombstone, hasAclSnapshot: false };
    const result = await restoreTrashedFile(restoreArgs({ fetch: makeFetch({}, tombstone) }));
    expect(mockRestoreAclFromSnapshot).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, restoredContainerUri: originalContainerUri, aclRestored: false });
  });

  it('reports aclRestored: false without failing the restore when ACL restore throws', async () => {
    mockRestoreAclFromSnapshot.mockRejectedValueOnce(new Error('acl write failed'));
    const result = await restoreTrashedFile(restoreArgs());
    expect(result).toEqual({ ok: true, restoredContainerUri: originalContainerUri, aclRestored: false });
  });

  it('appends the restored catalog row using the tombstone original catalog/instance URIs, not recomputed ones', async () => {
    await restoreTrashedFile(restoreArgs());
    expect(mockAppendToCatalog).toHaveBeenCalledWith({
      catalogUri: baseTombstone.originalCatalogUri,
      instanceUri: baseTombstone.originalInstanceUri,
      binaryUri: `${originalContainerUri}photo.jpg`,
      classUri: trashEntry.classUri,
      parentUri: 'https://pod.example/my-solid-app/',
      mediaType: trashEntry.mediaType,
      byteSize: trashEntry.byteSize,
      title: trashEntry.title,
      description: trashEntry.description,
      modified: trashEntry.modified,
      publisherWebId: ownerWebId,
      fetch: expect.any(Function),
    });
  });

  it('restores the file\'s catalog parent from the tombstone, not derived from its container URI', async () => {
    const tombstone = { ...baseTombstone, originalParentUri: 'https://pod.example/my-solid-app/vacation/' };
    await restoreTrashedFile(restoreArgs({ fetch: makeFetch({}, tombstone) }));

    expect(mockAppendToCatalog).toHaveBeenCalledWith(
      expect.objectContaining({ parentUri: 'https://pod.example/my-solid-app/vacation/' }),
    );
  });

  it('restores a file that lived at the storage root with no catalog parent', async () => {
    const tombstone = { ...baseTombstone, originalParentUri: '' };
    await restoreTrashedFile(restoreArgs({ fetch: makeFetch({}, tombstone) }));

    expect(mockAppendToCatalog).toHaveBeenCalledWith(expect.objectContaining({ parentUri: '' }));
  });

  it('removes the trash copy, targeting the trash catalog and the trashed item\'s metadata URI', async () => {
    await restoreTrashedFile(restoreArgs());
    expect(mockDeleteResource).toHaveBeenCalledWith({
      containerUri: trashItemContainerUri,
      fetch: expect.any(Function),
      catalogUri: 'https://pod.example/trash/catalog.ttl',
      metadataUri: trashEntry.metadataUri,
    });
  });

  it('notifies listeners that both the catalog and the ACL changed at the original location', async () => {
    await restoreTrashedFile(restoreArgs());
    expect(mockNotifyCatalogChanged).toHaveBeenCalledWith(baseTombstone.originalCatalogUri);
    expect(mockNotifyAclChanged).toHaveBeenCalledWith(originalContainerUri);
  });

  it('falls back to sensible defaults when the entry\'s type, format, and title are all empty', async () => {
    const entry: SharedEntry = { ...trashEntry, classUri: '', mediaType: '', title: '' };
    await restoreTrashedFile(restoreArgs({ entry }));

    expect(mockAppendToCatalog).toHaveBeenCalledWith({
      catalogUri: baseTombstone.originalCatalogUri,
      instanceUri: baseTombstone.originalInstanceUri,
      binaryUri: `${originalContainerUri}photo.jpg`,
      classUri: 'http://schema.org/DigitalDocument',
      parentUri: 'https://pod.example/my-solid-app/',
      mediaType: 'application/octet-stream',
      byteSize: trashEntry.byteSize,
      title: 'photo-2024',
      description: trashEntry.description,
      modified: trashEntry.modified,
      publisherWebId: ownerWebId,
      fetch: expect.any(Function),
    });
  });

  it('returns missing-tombstone and writes nothing when the tombstone is absent', async () => {
    const fetchFn = makeFetch({}, null);
    const result = await restoreTrashedFile(restoreArgs({ fetch: fetchFn }));

    expect(result).toEqual({ ok: false, reason: 'missing-tombstone' });
    expect(fetchFn.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')).toBe(false);
    expect(mockAppendToCatalog).not.toHaveBeenCalled();
    expect(mockDeleteResource).not.toHaveBeenCalled();
  });

  it('returns missing-tombstone for a folder-kind tombstone, which restoreTrashedFolder owns instead', async () => {
    const folderTombstone = { ...baseTombstone, kind: 'folder' as const, originalBinaryName: '' };
    const fetchFn = makeFetch({}, folderTombstone);
    const result = await restoreTrashedFile(restoreArgs({ fetch: fetchFn }));

    expect(result).toEqual({ ok: false, reason: 'missing-tombstone' });
  });

  it('returns occupied and writes nothing when the original location is occupied', async () => {
    const fetchFn = makeFetch({ [`HEAD ${originalContainerUri}index.ttl`]: okResponse('') });
    const result = await restoreTrashedFile(restoreArgs({ fetch: fetchFn }));

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: 'occupied' });
    expect(fetchFn.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')).toBe(false);
    expect(mockAppendToCatalog).not.toHaveBeenCalled();
    expect(mockDeleteResource).not.toHaveBeenCalled();
  });

  it('returns occupied and writes nothing when only the binary path (not index.ttl) is occupied', async () => {
    const fetchFn = makeFetch({ [`HEAD ${originalContainerUri}photo.jpg`]: okResponse('') });
    const result = await restoreTrashedFile(restoreArgs({ fetch: fetchFn }));

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: 'occupied' });
    expect(fetchFn.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')).toBe(false);
    expect(mockAppendToCatalog).not.toHaveBeenCalled();
    expect(mockDeleteResource).not.toHaveBeenCalled();
  });

  it('describes both versions in the conflict when the location is occupied', async () => {
    const fetchFn = makeFetch({
      [`HEAD ${originalContainerUri}photo.jpg`]: okResponse('', 'image/jpeg'),
    });
    const result = await restoreTrashedFile(restoreArgs({ fetch: fetchFn }));

    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== 'occupied') throw new Error('expected an occupied conflict');
    expect(result.conflict.trashed).toEqual({ modified: trashEntry.modified, byteSize: trashEntry.byteSize });
  });

  it('leaves the trashed side blank when the trashed entry has no modified date or byte size', async () => {
    const entry: SharedEntry = { ...trashEntry, modified: '', byteSize: 0 };
    const fetchFn = makeFetch({ [`HEAD ${originalContainerUri}photo.jpg`]: okResponse('', 'image/jpeg') });
    const result = await restoreTrashedFile(restoreArgs({ fetch: fetchFn, entry }));

    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== 'occupied') throw new Error('expected an occupied conflict');
    expect(result.conflict.trashed).toEqual({ modified: undefined, byteSize: undefined });
  });

  it('describes the occupant from its own catalog row when it has one, instead of guessing from response headers', async () => {
    const occupantCatalog = `
      @prefix dcat: <http://www.w3.org/ns/dcat#> .
      @prefix dcterms: <http://purl.org/dc/terms/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      <${baseTombstone.originalCatalogUri}> dcat:dataset <${baseTombstone.originalInstanceUri}> .
      <${baseTombstone.originalInstanceUri}> a dcat:Dataset ;
        dcterms:title "Occupant" ;
        dcterms:modified "2026-02-01T00:00:00.000Z"^^xsd:dateTime ;
        dcat:distribution <${baseTombstone.originalInstanceUri}#dist> .
      <${baseTombstone.originalInstanceUri}#dist> dcat:byteSize "9999"^^xsd:integer .
    `.trim();
    const fetchFn = makeFetch({
      [`HEAD ${originalContainerUri}photo.jpg`]: okResponse('', 'image/jpeg'),
      [`GET ${baseTombstone.originalCatalogUri}`]: okResponse(occupantCatalog, 'text/turtle'),
    });
    const result = await restoreTrashedFile(restoreArgs({ fetch: fetchFn }));

    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== 'occupied') throw new Error('expected an occupied conflict');
    expect(result.conflict.current).toEqual({ modified: '2026-02-01T00:00:00.000Z', byteSize: 9999 });
  });

  it('falls back to the occupant\'s response headers for its size and date when it has no catalog row', async () => {
    const fetchFn = makeFetch({
      [`HEAD ${originalContainerUri}photo.jpg`]: new Response('', {
        status: 200,
        headers: { 'Last-Modified': 'Sun, 01 Feb 2026 00:00:00 GMT', 'Content-Length': '4096' },
      }),
    });
    const result = await restoreTrashedFile(restoreArgs({ fetch: fetchFn }));

    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== 'occupied') throw new Error('expected an occupied conflict');
    expect(result.conflict.current).toEqual({
      modified: new Date('Sun, 01 Feb 2026 00:00:00 GMT').toISOString(),
      byteSize: 4096,
    });
  });

  it('reports "Unknown error" when reading the tombstone rejects with a non-Error value', async () => {
    const base = makeFetch();
    const fetchFn = vi.fn<FetchFn>(async (input, init) => {
      if (String(input) === tombstoneUri) throw 'plain string failure';
      return base(input, init);
    });
    const result = await restoreTrashedFile(restoreArgs({ fetch: fetchFn }));
    expect(result).toEqual({ ok: false, reason: 'failed', detail: 'Unknown error' });
  });

  it('reports "Unknown error" when the occupancy check rejects with a non-Error value', async () => {
    const base = makeFetch();
    const fetchFn = vi.fn<FetchFn>(async (input, init) => {
      const method = init?.method ?? 'GET';
      if (method === 'HEAD' && String(input) === `${originalContainerUri}index.ttl`) throw 'plain string failure';
      return base(input, init);
    });
    const result = await restoreTrashedFile(restoreArgs({ fetch: fetchFn }));
    expect(result).toEqual({ ok: false, reason: 'failed', detail: 'Unknown error' });
  });

  it('replace: builds the moved-aside entry from the occupant\'s own catalog row when it has one', async () => {
    const occupantCatalog = `
      @prefix dcat: <http://www.w3.org/ns/dcat#> .
      @prefix dcterms: <http://purl.org/dc/terms/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      <${baseTombstone.originalCatalogUri}> dcat:dataset <${baseTombstone.originalInstanceUri}> .
      <${baseTombstone.originalInstanceUri}> a dcat:Dataset ;
        dcterms:title "Occupant" ;
        dcterms:modified "2026-02-01T00:00:00.000Z"^^xsd:dateTime ;
        dcat:distribution <${baseTombstone.originalInstanceUri}#dist> .
      <${baseTombstone.originalInstanceUri}#dist> dcat:byteSize "9999"^^xsd:integer .
    `.trim();
    const fetchFn = makeFetch({
      [`HEAD ${originalContainerUri}photo.jpg`]: okResponse('', 'image/jpeg'),
      [`GET ${baseTombstone.originalCatalogUri}`]: okResponse(occupantCatalog, 'text/turtle'),
    });
    const result = await restoreTrashedFile(restoreArgs({ fetch: fetchFn, resolution: 'replace' }));

    expect(mockSoftDeleteFile).toHaveBeenCalledWith(
      expect.objectContaining({ entry: expect.objectContaining({ title: 'Occupant', byteSize: 9999 }) }),
    );
    expect(result.ok).toBe(true);
  });

  it('replace: moves the file in the way to the Recycle Bin, then restores into the freed location', async () => {
    const fetchFn = makeFetch({ [`HEAD ${originalContainerUri}photo.jpg`]: okResponse('', 'image/jpeg') });
    const result = await restoreTrashedFile(restoreArgs({ fetch: fetchFn, resolution: 'replace' }));

    expect(mockSoftDeleteFile).toHaveBeenCalledWith(
      expect.objectContaining({ containerUri: originalContainerUri, catalogUri: baseTombstone.originalCatalogUri }),
    );
    expect(result).toEqual({ ok: true, restoredContainerUri: originalContainerUri, aclRestored: true });
    expect(mockAppendToCatalog).toHaveBeenCalledWith(
      expect.objectContaining({ instanceUri: baseTombstone.originalInstanceUri, binaryUri: `${originalContainerUri}photo.jpg` }),
    );
  });

  it('replace: reports failure instead of restoring when moving the file in the way fails', async () => {
    mockSoftDeleteFile.mockResolvedValueOnce({ ok: false, reason: 'Missing permission' });
    const fetchFn = makeFetch({ [`HEAD ${originalContainerUri}photo.jpg`]: okResponse('', 'image/jpeg') });
    const result = await restoreTrashedFile(restoreArgs({ fetch: fetchFn, resolution: 'replace' }));

    expect(result).toEqual({ ok: false, reason: 'failed', detail: expect.stringContaining('Missing permission') });
    expect(mockAppendToCatalog).not.toHaveBeenCalled();
  });

  it('replace: flags occupantMovedToTrash when the restore itself fails after the file in the way was already moved', async () => {
    mockAppendToCatalog.mockRejectedValueOnce(new Error('catalog offline'));
    const fetchFn = makeFetch({ [`HEAD ${originalContainerUri}photo.jpg`]: okResponse('', 'image/jpeg') });
    const result = await restoreTrashedFile(restoreArgs({ fetch: fetchFn, resolution: 'replace' }));

    expect(mockSoftDeleteFile).toHaveBeenCalled();
    expect(result).toEqual({ ok: false, reason: 'failed', detail: 'catalog offline', occupantMovedToTrash: true });
  });

  it('keepBoth: restores under a new location instead of replacing what is already there', async () => {
    const fetchFn = makeFetch({ [`HEAD ${originalContainerUri}photo.jpg`]: okResponse('', 'image/jpeg') });
    const result = await restoreTrashedFile(restoreArgs({ fetch: fetchFn, resolution: 'keepBoth' }));

    expect(mockSoftDeleteFile).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected the restore to succeed');
    expect(result.restoredContainerUri).not.toBe(originalContainerUri);
    expect(result.restoredContainerUri.startsWith(originalContainerUri.replace(/\/$/, ''))).toBe(true);
    expect(result.restoredContainerUri).toBe('https://pod.example/my-solid-app/photo-2024%20(restored)/');
  });

  it('keepBoth: counts up to "(restored 2)" when the plain "(restored)" spot is also taken', async () => {
    const fetchFn = makeFetch({
      [`HEAD ${originalContainerUri}photo.jpg`]: okResponse('', 'image/jpeg'),
      [`HEAD https://pod.example/my-solid-app/photo-2024%20(restored)/index.ttl`]: okResponse(''),
    });
    const result = await restoreTrashedFile(restoreArgs({ fetch: fetchFn, resolution: 'keepBoth' }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected the restore to succeed');
    expect(result.restoredContainerUri).toBe('https://pod.example/my-solid-app/photo-2024%20(restored%202)/');
  });

  it('keepBoth: appends the catalog row under the new location\'s own instance uri, not the tombstone\'s original one', async () => {
    const fetchFn = makeFetch({ [`HEAD ${originalContainerUri}photo.jpg`]: okResponse('', 'image/jpeg') });
    await restoreTrashedFile(restoreArgs({ fetch: fetchFn, resolution: 'keepBoth' }));

    const [[appendArgs]] = mockAppendToCatalog.mock.calls;
    expect(appendArgs.instanceUri).not.toBe(baseTombstone.originalInstanceUri);
    expect(appendArgs.instanceUri.startsWith(originalContainerUri.replace(/\/$/, ''))).toBe(true);
  });

  it('bypasses cached responses when checking occupancy, so a location freed or claimed by another client is seen immediately', async () => {
    const fetchFn = makeFetch();
    await restoreTrashedFile(restoreArgs({ fetch: fetchFn }));

    const occupancyChecks = fetchFn.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === 'HEAD',
    );
    expect(occupancyChecks).toHaveLength(2);
    for (const [, init] of occupancyChecks) {
      expect((init as RequestInit).cache).toBe('no-store');
    }
  });

  it('returns a failed result instead of throwing when reading the tombstone errors out', async () => {
    const fetchFn = makeFetch({ [`GET ${tombstoneUri}`]: errorResponse(500, 'Server Error') });
    const result = await restoreTrashedFile(restoreArgs({ fetch: fetchFn }));

    expect(result).toEqual({ ok: false, reason: 'failed', detail: expect.stringContaining('500') });
    expect(mockAppendToCatalog).not.toHaveBeenCalled();
    expect(mockDeleteResource).not.toHaveBeenCalled();
  });

  it('rolls back the partial restore and leaves the trash copy intact when the binary copy fails', async () => {
    const fetchFn = makeFetch({ [`GET ${trashPayloadUri}`]: errorResponse(500, 'Server Error') });
    const result = await restoreTrashedFile(restoreArgs({ fetch: fetchFn }));

    expect(result).toEqual({ ok: false, reason: 'failed', detail: expect.stringContaining('500') });
    expect(mockDeleteResource).toHaveBeenCalledTimes(1);
    expect(mockDeleteResource).toHaveBeenCalledWith({ containerUri: originalContainerUri, fetch: fetchFn });
  });

  it('rolls back the partial restore when saving the catalog entry fails', async () => {
    mockAppendToCatalog.mockRejectedValueOnce(new Error('catalog offline'));
    const fetchFn = makeFetch();
    const result = await restoreTrashedFile(restoreArgs({ fetch: fetchFn }));

    expect(result).toEqual({ ok: false, reason: 'failed', detail: 'catalog offline' });
    expect(mockDeleteResource).toHaveBeenCalledTimes(1);
    expect(mockDeleteResource).toHaveBeenCalledWith({ containerUri: originalContainerUri, fetch: fetchFn });
  });

  it('ignores a failing rollback delete so the failure result still surfaces', async () => {
    mockAppendToCatalog.mockRejectedValueOnce(new Error('catalog offline'));
    mockDeleteResource.mockRejectedValueOnce(new Error('rollback network down'));
    const result = await restoreTrashedFile(restoreArgs());
    expect(result).toEqual({ ok: false, reason: 'failed', detail: 'catalog offline' });
  });

  it('reports "Unknown error" as the detail for a non-Error rejection', async () => {
    mockAppendToCatalog.mockRejectedValueOnce('plain string failure');
    const result = await restoreTrashedFile(restoreArgs());
    expect(result).toEqual({ ok: false, reason: 'failed', detail: 'Unknown error' });
  });
});

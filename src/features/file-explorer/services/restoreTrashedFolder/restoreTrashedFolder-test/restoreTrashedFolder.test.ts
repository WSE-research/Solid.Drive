import { describe, it, expect, vi, beforeEach } from 'vitest';
import { restoreTrashedFolder } from '../restoreTrashedFolder-file/restoreTrashedFolder';
import { buildTombstoneTurtle, type Tombstone } from '@/infrastructure/solid/tombstone';
import type { FetchFn } from '@/types/solid';

const mockAppendToCatalog = vi.fn().mockResolvedValue(undefined);
const mockAppendFolderToCatalog = vi.fn().mockResolvedValue(undefined);
vi.mock('@/infrastructure/solid/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infrastructure/solid/catalog')>();
  return {
    ...actual,
    appendToCatalog: (...args: unknown[]) => mockAppendToCatalog(...args),
    appendFolderToCatalog: (...args: unknown[]) => mockAppendFolderToCatalog(...args),
  };
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

const storageRootUri = 'https://pod.example/';
const trashItemContainerUri = 'https://pod.example/trash/abc123/';
const trashCatalogUri = 'https://pod.example/trash/catalog.ttl';
const tombstoneUri = `${trashItemContainerUri}tombstone.ttl`;
const snapshotUri = `${trashItemContainerUri}catalog-snapshot.ttl`;
const trashPayloadContainerUri = `${trashItemContainerUri}payload/`;

const originalContainerUri = 'https://pod.example/my-solid-app/photos/';
const originalParentUri = 'https://pod.example/my-solid-app/';
const originalCatalogUri = 'https://pod.example/catalog.ttl';
const subFolderUri = `${originalContainerUri}vacation/`;
const fileInstanceUri = `${originalContainerUri}beach.jpg/index.ttl`;
const fileBinaryUri = `${originalContainerUri}beach.jpg/beach.jpg`;
const subFileInstanceUri = `${subFolderUri}sunset.jpg/index.ttl`;
const subFileBinaryUri = `${subFolderUri}sunset.jpg/sunset.jpg`;

const trashFileContainerUri = `${trashPayloadContainerUri}beach.jpg/`;
const trashFileInstanceUri = `${trashFileContainerUri}index.ttl`;
const trashFileBinaryUri = `${trashFileContainerUri}beach.jpg`;
const trashSubFolderUri = `${trashPayloadContainerUri}vacation/`;
const trashSubFileContainerUri = `${trashSubFolderUri}sunset.jpg/`;
const trashSubFileInstanceUri = `${trashSubFileContainerUri}index.ttl`;
const trashSubFileBinaryUri = `${trashSubFileContainerUri}sunset.jpg`;

const baseTombstone: Tombstone = {
  kind: 'folder',
  originalContainerUri,
  originalParentUri,
  originalCatalogUri,
  originalInstanceUri: originalContainerUri,
  originalBinaryName: '',
  originalClassUri: 'https://purl.org/solid-drive/catalog#Folder',
  hasAclSnapshot: true,
  deletedAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-01-31T00:00:00.000Z',
};

const DCAT = 'http://www.w3.org/ns/dcat#';
const DCTERMS = 'http://purl.org/dc/terms/';
const XSD = 'http://www.w3.org/2001/XMLSchema#';
const HAS_PARENT = 'https://purl.org/solid-drive/catalog#hasParent';
const FOLDER_CLASS = 'https://purl.org/solid-drive/catalog#Folder';

interface FixtureEntry {
  uri: string;
  kind: 'folder' | 'file';
  title: string;
  modified: string;
  parentUri?: string;
  classUri?: string;
  mediaType?: string;
  byteSize?: number;
  accessURL?: string;
  description?: string;
}

function snapshotTurtle(entries: FixtureEntry[]): string {
  const lines: string[] = [];
  for (const entry of entries) {
    lines.push(`<${snapshotUri}> <${DCAT}dataset> <${entry.uri}> .`);
    lines.push(`<${entry.uri}> <${DCTERMS}title> "${entry.title}" .`);
    lines.push(`<${entry.uri}> <${DCTERMS}modified> "${entry.modified}"^^<${XSD}dateTime> .`);
    lines.push(`<${entry.uri}> <${DCTERMS}publisher> <https://owner.example/#me> .`);
    if (entry.parentUri) lines.push(`<${entry.uri}> <${HAS_PARENT}> <${entry.parentUri}> .`);
    if (entry.kind === 'folder') {
      lines.push(`<${entry.uri}> <${DCTERMS}conformsTo> <${FOLDER_CLASS}> .`);
    } else {
      lines.push(`<${entry.uri}> <${DCTERMS}conformsTo> <${entry.classUri}> .`);
      lines.push(`<${entry.uri}> <${DCTERMS}description> "${entry.description ?? ''}" .`);
      lines.push(`<${entry.uri}> <${DCAT}distribution> <${entry.uri}#dist> .`);
      lines.push(`<${entry.uri}#dist> <${DCAT}accessURL> <${entry.accessURL}> .`);
      lines.push(`<${entry.uri}#dist> <${DCAT}mediaType> "${entry.mediaType}" .`);
      lines.push(`<${entry.uri}#dist> <${DCAT}byteSize> "${entry.byteSize}"^^<${XSD}integer> .`);
    }
  }
  return lines.join('\n');
}

const snapshotEntries: FixtureEntry[] = [
  { uri: originalContainerUri, kind: 'folder', title: 'Photos', modified: '2026-01-10T00:00:00.000Z', parentUri: originalParentUri },
  { uri: subFolderUri, kind: 'folder', title: 'Vacation', modified: '2026-01-05T00:00:00.000Z', parentUri: originalContainerUri },
  {
    uri: fileInstanceUri, kind: 'file', title: 'beach.jpg', modified: '2026-01-08T00:00:00.000Z', parentUri: originalContainerUri,
    classUri: 'http://schema.org/ImageObject', mediaType: 'image/jpeg', byteSize: 1024, accessURL: fileBinaryUri, description: 'a beach',
  },
  {
    uri: subFileInstanceUri, kind: 'file', title: 'sunset.jpg', modified: '2026-01-06T00:00:00.000Z', parentUri: subFolderUri,
    classUri: 'http://schema.org/ImageObject', mediaType: 'image/jpeg', byteSize: 2048, accessURL: subFileBinaryUri, description: '',
  },
];

const turtleWithChildren = (base: string, children: string[]): string =>
  [
    '@prefix ldp: <http://www.w3.org/ns/ldp#> .',
    `<${base}> ${children.map((child) => `ldp:contains <${child}>`).join(' ; ')} .`,
  ].join('\n');

function okResponse(body = '', contentType?: string): Response {
  return new Response(body, { status: 200, headers: contentType ? { 'Content-Type': contentType } : undefined });
}

function errorResponse(status: number, statusText: string): Response {
  return new Response('', { status, statusText });
}

function makeFetch(overrides: Record<string, Response> = {}, tombstone: Tombstone | null = baseTombstone): ReturnType<typeof vi.fn<FetchFn>> {
  return vi.fn<FetchFn>(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const key = `${method} ${url}`;
    if (overrides[key]) return overrides[key];
    if (overrides[url]) return overrides[url];
    if (url === tombstoneUri) {
      return tombstone ? okResponse(buildTombstoneTurtle(tombstoneUri, tombstone), 'text/turtle') : errorResponse(404, 'Not Found');
    }
    if (method === 'HEAD' && url === originalContainerUri) return errorResponse(404, 'Not Found');
    if (method === 'PUT') return okResponse('', undefined);
    if (url === snapshotUri) return okResponse(snapshotTurtle(snapshotEntries), 'text/turtle');
    if (url === trashPayloadContainerUri) return okResponse(turtleWithChildren(trashPayloadContainerUri, [trashFileContainerUri, trashSubFolderUri]), 'text/turtle');
    if (url === trashFileContainerUri) return okResponse(turtleWithChildren(trashFileContainerUri, [trashFileInstanceUri, trashFileBinaryUri]), 'text/turtle');
    if (url === trashSubFolderUri) return okResponse(turtleWithChildren(trashSubFolderUri, [trashSubFileContainerUri]), 'text/turtle');
    if (url === trashSubFileContainerUri) return okResponse(turtleWithChildren(trashSubFileContainerUri, [trashSubFileInstanceUri, trashSubFileBinaryUri]), 'text/turtle');
    if (url === trashFileInstanceUri || url === trashSubFileInstanceUri) return okResponse('<> a <#Dataset> .', 'text/turtle');
    if (url === trashFileBinaryUri || url === trashSubFileBinaryUri) return okResponse('binary-data', 'image/jpeg');
    return errorResponse(404, 'Not Found');
  });
}

function restoreArgs(overrides: Partial<Parameters<typeof restoreTrashedFolder>[0]> = {}) {
  return {
    trashItemContainerUri,
    storageRootUri,
    fetch: makeFetch(),
    ...overrides,
  };
}

describe('restoreTrashedFolder', () => {
  beforeEach(() => {
    mockAppendToCatalog.mockClear().mockResolvedValue(undefined);
    mockAppendFolderToCatalog.mockClear().mockResolvedValue(undefined);
    mockRestoreAclFromSnapshot.mockClear().mockResolvedValue(true);
    mockDeleteResource.mockClear().mockResolvedValue({ ok: true });
    mockNotifyCatalogChanged.mockClear();
    mockNotifyAclChanged.mockClear();
  });

  it('restores the folder to its original location and reports its ACL as restored', async () => {
    const result = await restoreTrashedFolder(restoreArgs());
    expect(result).toEqual({ ok: true, restoredContainerUri: originalContainerUri, aclRestored: true });
  });

  it('mirrors the trash payload back onto the original subtree', async () => {
    const fetchFn = makeFetch();
    await restoreTrashedFolder(restoreArgs({ fetch: fetchFn }));

    const puts = fetchFn.mock.calls
      .filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
      .map(([url]) => String(url));
    expect(puts).toEqual(expect.arrayContaining([
      originalContainerUri,
      `${originalContainerUri}beach.jpg/`,
      fileInstanceUri,
      fileBinaryUri,
      subFolderUri,
      `${subFolderUri}sunset.jpg/`,
      subFileInstanceUri,
      subFileBinaryUri,
    ]));
  });

  it('restores the ACL from the snapshot when the tombstone says one was captured', async () => {
    await restoreTrashedFolder(restoreArgs());
    expect(mockRestoreAclFromSnapshot).toHaveBeenCalledWith(
      `${trashItemContainerUri}acl-snapshot.ttl`,
      originalContainerUri,
      expect.any(Function),
    );
  });

  it('skips restoring the ACL, and reports it as not restored, when the tombstone says none was captured', async () => {
    const tombstone = { ...baseTombstone, hasAclSnapshot: false };
    const result = await restoreTrashedFolder(restoreArgs({ fetch: makeFetch({}, tombstone) }));
    expect(mockRestoreAclFromSnapshot).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, restoredContainerUri: originalContainerUri, aclRestored: false });
  });

  it('still succeeds, just without a restored ACL, when restoring the ACL itself fails', async () => {
    mockRestoreAclFromSnapshot.mockRejectedValueOnce(new Error('acl write failed'));
    const result = await restoreTrashedFolder(restoreArgs());
    expect(result).toEqual({ ok: true, restoredContainerUri: originalContainerUri, aclRestored: false });
  });

  it('replays every snapshot entry into the original catalog, unchanged', async () => {
    await restoreTrashedFolder(restoreArgs());

    expect(mockAppendFolderToCatalog).toHaveBeenCalledWith(expect.objectContaining({
      catalogUri: originalCatalogUri, folderUri: originalContainerUri, parentUri: originalParentUri, title: 'Photos',
    }));
    expect(mockAppendFolderToCatalog).toHaveBeenCalledWith(expect.objectContaining({
      catalogUri: originalCatalogUri, folderUri: subFolderUri, parentUri: originalContainerUri, title: 'Vacation',
    }));
    expect(mockAppendToCatalog).toHaveBeenCalledWith(expect.objectContaining({
      catalogUri: originalCatalogUri, instanceUri: fileInstanceUri, parentUri: originalContainerUri, title: 'beach.jpg',
    }));
    expect(mockAppendToCatalog).toHaveBeenCalledWith(expect.objectContaining({
      catalogUri: originalCatalogUri, instanceUri: subFileInstanceUri, parentUri: subFolderUri, title: 'sunset.jpg',
    }));
  });

  it('restores a folder with no catalogued descendants when the snapshot is missing', async () => {
    const fetchFn = makeFetch({ [`GET ${snapshotUri}`]: errorResponse(404, 'Not Found') });
    const result = await restoreTrashedFolder(restoreArgs({ fetch: fetchFn }));

    expect(result.ok).toBe(true);
    expect(mockAppendFolderToCatalog).not.toHaveBeenCalled();
    expect(mockAppendToCatalog).not.toHaveBeenCalled();
  });

  it('removes the trash copy, targeting the trash catalog and the trash item\'s own URI', async () => {
    await restoreTrashedFolder(restoreArgs());
    expect(mockDeleteResource).toHaveBeenCalledWith({
      containerUri: trashItemContainerUri,
      fetch: expect.any(Function),
      catalogUri: trashCatalogUri,
      metadataUri: trashItemContainerUri,
    });
  });

  it('notifies listeners that both the catalog and the ACL changed at the original location', async () => {
    await restoreTrashedFolder(restoreArgs());
    expect(mockNotifyCatalogChanged).toHaveBeenCalledWith(originalCatalogUri);
    expect(mockNotifyAclChanged).toHaveBeenCalledWith(originalContainerUri);
  });

  it('reports a missing tombstone and writes nothing when there is no tombstone to restore from', async () => {
    const fetchFn = makeFetch({}, null);
    const result = await restoreTrashedFolder(restoreArgs({ fetch: fetchFn }));

    expect(result).toEqual({ ok: false, reason: 'missing-tombstone' });
    expect(fetchFn.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')).toBe(false);
    expect(mockDeleteResource).not.toHaveBeenCalled();
  });

  it('reports a missing tombstone for a file\'s tombstone, since restoring a file is a different service\'s job', async () => {
    const fileTombstone = { ...baseTombstone, kind: 'file' as const, originalBinaryName: 'beach.jpg' };
    const fetchFn = makeFetch({}, fileTombstone);
    const result = await restoreTrashedFolder(restoreArgs({ fetch: fetchFn }));

    expect(result).toEqual({ ok: false, reason: 'missing-tombstone' });
  });

  it('reports the location as occupied and writes nothing when something is already there', async () => {
    const fetchFn = makeFetch({ [`HEAD ${originalContainerUri}`]: okResponse('') });
    const result = await restoreTrashedFolder(restoreArgs({ fetch: fetchFn }));

    expect(result).toEqual({ ok: false, reason: 'occupied' });
    expect(fetchFn.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')).toBe(false);
    expect(mockDeleteResource).not.toHaveBeenCalled();
  });

  it('bypasses cached responses when checking occupancy', async () => {
    const fetchFn = makeFetch();
    await restoreTrashedFolder(restoreArgs({ fetch: fetchFn }));

    const occupancyChecks = fetchFn.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'HEAD');
    expect(occupancyChecks).toHaveLength(1);
    expect((occupancyChecks[0][1] as RequestInit).cache).toBe('no-store');
  });

  it('returns a failed result instead of throwing when reading the tombstone errors out', async () => {
    const fetchFn = makeFetch({ [`GET ${tombstoneUri}`]: errorResponse(500, 'Server Error') });
    const result = await restoreTrashedFolder(restoreArgs({ fetch: fetchFn }));

    expect(result).toEqual({ ok: false, reason: 'failed', detail: expect.stringContaining('500') });
    expect(mockDeleteResource).not.toHaveBeenCalled();
  });

  it('rolls back the partial restore and leaves the trash copy intact when the subtree copy fails', async () => {
    const fetchFn = makeFetch({ [`GET ${trashFileBinaryUri}`]: errorResponse(500, 'Server Error') });
    const result = await restoreTrashedFolder(restoreArgs({ fetch: fetchFn }));

    expect(result).toEqual({ ok: false, reason: 'failed', detail: expect.stringContaining('500') });
    expect(mockDeleteResource).toHaveBeenCalledTimes(1);
    expect(mockDeleteResource).toHaveBeenCalledWith({
      containerUri: originalContainerUri,
      catalogUri: originalCatalogUri,
      metadataUri: originalContainerUri,
      fetch: fetchFn,
    });
  });

  it('rolls back the partial restore when replaying a snapshot entry fails, undoing whatever was already replayed into the catalog', async () => {
    mockAppendFolderToCatalog.mockRejectedValueOnce(new Error('catalog offline'));
    const fetchFn = makeFetch();
    const result = await restoreTrashedFolder(restoreArgs({ fetch: fetchFn }));

    expect(result).toEqual({ ok: false, reason: 'failed', detail: 'catalog offline' });
    expect(mockDeleteResource).toHaveBeenCalledTimes(1);
    // catalogUri/metadataUri are what let the rollback strip any catalog
    // rows a partial replay already wrote, not just the physical copy.
    expect(mockDeleteResource).toHaveBeenCalledWith({
      containerUri: originalContainerUri,
      catalogUri: originalCatalogUri,
      metadataUri: originalContainerUri,
      fetch: fetchFn,
    });
  });

  it('rolls back and strips already-replayed catalog rows when a later entry in the same restore fails', async () => {
    // The root folder's own replay succeeds; its first descendant fails.
    // Rollback must still target the catalog, not just the physical copy,
    // since the root's row genuinely made it into the original catalog.
    mockAppendFolderToCatalog.mockResolvedValueOnce(undefined);
    mockAppendFolderToCatalog.mockRejectedValueOnce(new Error('catalog offline'));
    const fetchFn = makeFetch();
    const result = await restoreTrashedFolder(restoreArgs({ fetch: fetchFn }));

    expect(result).toEqual({ ok: false, reason: 'failed', detail: 'catalog offline' });
    expect(mockAppendFolderToCatalog).toHaveBeenCalledTimes(2);
    expect(mockDeleteResource).toHaveBeenCalledWith({
      containerUri: originalContainerUri,
      catalogUri: originalCatalogUri,
      metadataUri: originalContainerUri,
      fetch: fetchFn,
    });
  });

  it('ignores a failing rollback delete so the failure result still surfaces', async () => {
    mockAppendFolderToCatalog.mockRejectedValueOnce(new Error('catalog offline'));
    mockDeleteResource.mockRejectedValueOnce(new Error('rollback network down'));
    const result = await restoreTrashedFolder(restoreArgs());
    expect(result).toEqual({ ok: false, reason: 'failed', detail: 'catalog offline' });
  });

  it('falls back to a generic error message when the failure is not a real Error object', async () => {
    mockAppendFolderToCatalog.mockRejectedValueOnce('plain string failure');
    const result = await restoreTrashedFolder(restoreArgs());
    expect(result).toEqual({ ok: false, reason: 'failed', detail: 'Unknown error' });
  });
});

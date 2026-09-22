import { describe, it, expect, vi, beforeEach } from 'vitest';
import { softDeleteFolder } from '../softDeleteFolder-file/softDeleteFolder';
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

const mockSnapshotAcl = vi.fn().mockResolvedValue(true);
vi.mock('@/infrastructure/wac/aclSnapshot', () => ({
  snapshotAcl: (...args: unknown[]) => mockSnapshotAcl(...args),
}));

const mockCheckHasPermission = vi.fn().mockResolvedValue(true);
vi.mock('@/infrastructure/wac/wacAllow', () => ({
  checkHasPermission: (...args: unknown[]) => mockCheckHasPermission(...args),
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

const storageRootUri = 'https://pod.example/';
const catalogUri = 'https://pod.example/catalog.ttl';
const ownerWebId = 'https://owner.example/#me';
const containerUri = 'https://pod.example/my-solid-app/photos/';
const parentContainerUri = 'https://pod.example/my-solid-app/';
const trashItemContainerUri = 'https://pod.example/trash/abc123/';
const trashCatalogUri = 'https://pod.example/trash/catalog.ttl';
const trashPayloadContainerUri = `${trashItemContainerUri}payload/`;

const fileContainerUri = `${containerUri}beach.jpg/`;
const fileInstanceUri = `${fileContainerUri}index.ttl`;
const fileBinaryUri = `${fileContainerUri}beach.jpg`;
const subFolderUri = `${containerUri}vacation/`;
const subFileContainerUri = `${subFolderUri}sunset.jpg/`;
const subFileInstanceUri = `${subFileContainerUri}index.ttl`;
const subFileBinaryUri = `${subFileContainerUri}sunset.jpg`;

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

function catalogTurtle(entries: FixtureEntry[]): string {
  const lines: string[] = [];
  for (const entry of entries) {
    lines.push(`<${catalogUri}> <${DCAT}dataset> <${entry.uri}> .`);
    lines.push(`<${entry.uri}> <${DCTERMS}title> "${entry.title}" .`);
    lines.push(`<${entry.uri}> <${DCTERMS}modified> "${entry.modified}"^^<${XSD}dateTime> .`);
    lines.push(`<${entry.uri}> <${DCTERMS}publisher> <${ownerWebId}> .`);
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

const rootEntry: FixtureEntry = { uri: containerUri, kind: 'folder', title: 'Photos', modified: '2026-01-10T00:00:00.000Z', parentUri: parentContainerUri };
const subFolderEntry: FixtureEntry = { uri: subFolderUri, kind: 'folder', title: 'Vacation', modified: '2026-01-05T00:00:00.000Z', parentUri: containerUri };
const fileEntry: FixtureEntry = {
  uri: fileInstanceUri, kind: 'file', title: 'beach.jpg', modified: '2026-01-08T00:00:00.000Z', parentUri: containerUri,
  classUri: 'http://schema.org/ImageObject', mediaType: 'image/jpeg', byteSize: 1024, accessURL: fileBinaryUri, description: 'a beach',
};
const subFileEntry: FixtureEntry = {
  uri: subFileInstanceUri, kind: 'file', title: 'sunset.jpg', modified: '2026-01-06T00:00:00.000Z', parentUri: subFolderUri,
  classUri: 'http://schema.org/ImageObject', mediaType: 'image/jpeg', byteSize: 2048, accessURL: subFileBinaryUri, description: '',
};

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

function makeFetch(overrides: Record<string, Response> = {}, entries: FixtureEntry[] = [rootEntry, subFolderEntry, fileEntry, subFileEntry]): ReturnType<typeof vi.fn<FetchFn>> {
  return vi.fn<FetchFn>(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const key = `${method} ${url}`;
    if (overrides[key]) return overrides[key];
    if (overrides[url]) return overrides[url];
    if (method === 'PUT') return okResponse('', undefined);
    if (url === catalogUri) return okResponse(catalogTurtle(entries), 'text/turtle');
    if (url === containerUri) return okResponse(turtleWithChildren(containerUri, [fileContainerUri, subFolderUri]), 'text/turtle');
    if (url === fileContainerUri) return okResponse(turtleWithChildren(fileContainerUri, [fileInstanceUri, fileBinaryUri]), 'text/turtle');
    if (url === subFolderUri) return okResponse(turtleWithChildren(subFolderUri, [subFileContainerUri]), 'text/turtle');
    if (url === subFileContainerUri) return okResponse(turtleWithChildren(subFileContainerUri, [subFileInstanceUri, subFileBinaryUri]), 'text/turtle');
    if (url === fileInstanceUri || url === subFileInstanceUri) return okResponse('<> a <#Dataset> .', 'text/turtle');
    if (url === fileBinaryUri || url === subFileBinaryUri) return okResponse('binary-data', 'image/jpeg');
    return errorResponse(404, 'Not Found');
  });
}

function softDeleteArgs(overrides: Partial<Parameters<typeof softDeleteFolder>[0]> = {}) {
  return {
    containerUri,
    storageRootUri,
    catalogUri,
    ownerWebId,
    fetch: makeFetch(),
    now: new Date('2026-01-15T00:00:00.000Z'),
    uniqueSuffix: 'abc123',
    ...overrides,
  };
}

describe('softDeleteFolder', () => {
  beforeEach(() => {
    mockAppendToCatalog.mockClear().mockResolvedValue(undefined);
    mockAppendFolderToCatalog.mockClear().mockResolvedValue(undefined);
    mockSnapshotAcl.mockClear().mockResolvedValue(true);
    mockCheckHasPermission.mockClear().mockResolvedValue(true);
    mockDeleteResource.mockClear().mockResolvedValue({ ok: true });
    mockNotifyCatalogChanged.mockClear();
  });

  it('checks permission on the folder and its parent before touching anything', async () => {
    await softDeleteFolder(softDeleteArgs());
    expect(mockCheckHasPermission).toHaveBeenCalledWith(containerUri, parentContainerUri, expect.any(Function));
  });

  it('fails cleanly without writing anything when the agent lacks permission', async () => {
    mockCheckHasPermission.mockResolvedValueOnce(false);
    const fetchFn = makeFetch();
    const result = await softDeleteFolder(softDeleteArgs({ fetch: fetchFn }));

    expect(result).toEqual({ ok: false, reason: 'Missing permission to delete this folder' });
    expect(mockDeleteResource).not.toHaveBeenCalled();
    expect(fetchFn.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')).toBe(false);
  });

  it('mirrors the whole subtree into the trash payload container', async () => {
    const fetchFn = makeFetch();
    await softDeleteFolder(softDeleteArgs({ fetch: fetchFn }));

    const puts = fetchFn.mock.calls
      .filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
      .map(([url]) => String(url));
    expect(puts).toEqual(expect.arrayContaining([
      trashPayloadContainerUri,
      `${trashPayloadContainerUri}beach.jpg/`,
      `${trashPayloadContainerUri}beach.jpg/index.ttl`,
      `${trashPayloadContainerUri}beach.jpg/beach.jpg`,
      `${trashPayloadContainerUri}vacation/`,
      `${trashPayloadContainerUri}vacation/sunset.jpg/`,
      `${trashPayloadContainerUri}vacation/sunset.jpg/index.ttl`,
      `${trashPayloadContainerUri}vacation/sunset.jpg/sunset.jpg`,
    ]));
  });

  it('writes a catalog snapshot entry for the root folder and every descendant', async () => {
    await softDeleteFolder(softDeleteArgs());

    const snapshotUri = `${trashItemContainerUri}catalog-snapshot.ttl`;
    expect(mockAppendFolderToCatalog).toHaveBeenCalledWith(expect.objectContaining({ catalogUri: snapshotUri, folderUri: containerUri, title: 'Photos' }));
    expect(mockAppendFolderToCatalog).toHaveBeenCalledWith(expect.objectContaining({ catalogUri: snapshotUri, folderUri: subFolderUri, title: 'Vacation' }));
    expect(mockAppendToCatalog).toHaveBeenCalledWith(expect.objectContaining({ catalogUri: snapshotUri, instanceUri: fileInstanceUri, title: 'beach.jpg' }));
    expect(mockAppendToCatalog).toHaveBeenCalledWith(expect.objectContaining({ catalogUri: snapshotUri, instanceUri: subFileInstanceUri, title: 'sunset.jpg' }));
  });

  it('snapshots the ACL of the folder into the trash item container', async () => {
    await softDeleteFolder(softDeleteArgs());
    expect(mockSnapshotAcl).toHaveBeenCalledWith(containerUri, `${trashItemContainerUri}acl-snapshot.ttl`, expect.any(Function));
  });

  it('writes a folder-kind tombstone recording the original container and catalog', async () => {
    const fetchFn = makeFetch();
    await softDeleteFolder(softDeleteArgs({ fetch: fetchFn, retentionDays: 10 }));

    const tombstonePut = fetchFn.mock.calls.find(
      ([url, init]) => url === `${trashItemContainerUri}tombstone.ttl` && (init as RequestInit | undefined)?.method === 'PUT',
    );
    const body = String((tombstonePut![1] as RequestInit).body);
    expect(body).toContain('"folder"');
    expect(body).toContain(containerUri);
    expect(body).toContain(parentContainerUri);
    expect(body).toContain(catalogUri);
    expect(body).toContain('2026-01-15T00:00:00.000Z');
    expect(body).toContain('2026-01-25T00:00:00.000Z');
    expect(body).not.toContain('originalBinaryName');
  });

  it('appends a folder-shaped trash catalog entry pointing at the trash item container', async () => {
    await softDeleteFolder(softDeleteArgs());
    expect(mockAppendFolderToCatalog).toHaveBeenCalledWith({
      catalogUri: trashCatalogUri,
      folderUri: trashItemContainerUri,
      parentUri: '',
      title: 'Photos',
      modified: rootEntry.modified,
      publisherWebId: ownerWebId,
      fetch: expect.any(Function),
    });
  });

  it('removes the original folder using its own URI as both container and catalog key', async () => {
    await softDeleteFolder(softDeleteArgs());
    expect(mockDeleteResource).toHaveBeenCalledWith({
      containerUri,
      metadataUri: containerUri,
      catalogUri,
      fetch: expect.any(Function),
    });
  });

  it('notifies listeners that the trash catalog changed, on success', async () => {
    await softDeleteFolder(softDeleteArgs());
    expect(mockNotifyCatalogChanged).toHaveBeenCalledWith(trashCatalogUri);
  });

  it('still succeeds and records no ACL snapshot when the folder has none to begin with', async () => {
    mockSnapshotAcl.mockResolvedValueOnce(false);
    const result = await softDeleteFolder(softDeleteArgs());
    expect(result.ok).toBe(true);
  });

  it('still succeeds when reading the ACL fails', async () => {
    mockSnapshotAcl.mockRejectedValueOnce(new Error('acl unreadable'));
    const result = await softDeleteFolder(softDeleteArgs());
    expect(result.ok).toBe(true);
    expect(mockDeleteResource).toHaveBeenCalledTimes(1);
  });

  it('falls back to the URI segment and derived parent for a folder with no catalog entry of its own', async () => {
    const fetchFn = makeFetch({}, [fileEntry]);
    const result = await softDeleteFolder(softDeleteArgs({ fetch: fetchFn }));

    expect(result.ok).toBe(true);
    expect(mockAppendFolderToCatalog).toHaveBeenCalledWith(expect.objectContaining({
      catalogUri: trashCatalogUri,
      title: 'photos',
      publisherWebId: ownerWebId,
    }));
  });

  it('still deletes when the main catalog cannot be read at all', async () => {
    const fetchFn = makeFetch({ [`GET ${catalogUri}`]: errorResponse(500, 'Server Error') });
    const result = await softDeleteFolder(softDeleteArgs({ fetch: fetchFn }));

    expect(result.ok).toBe(true);
    expect(mockAppendFolderToCatalog).toHaveBeenCalledWith(expect.objectContaining({ catalogUri: trashCatalogUri, title: 'photos' }));
  });

  it('rolls back the trash copy and does not touch the original when the subtree copy fails', async () => {
    const fetchFn = makeFetch({ [`GET ${fileBinaryUri}`]: errorResponse(500, 'Server Error') });
    const result = await softDeleteFolder(softDeleteArgs({ fetch: fetchFn }));

    expect(result).toEqual({ ok: false, reason: expect.stringContaining('500') });
    expect(mockDeleteResource).toHaveBeenCalledTimes(1);
    expect(mockDeleteResource).toHaveBeenCalledWith({ containerUri: trashItemContainerUri, fetch: fetchFn });
  });

  it('rolls back the trash copy and does not touch the original when writing a catalog snapshot entry fails', async () => {
    mockAppendFolderToCatalog.mockRejectedValueOnce(new Error('catalog offline'));
    const fetchFn = makeFetch();
    const result = await softDeleteFolder(softDeleteArgs({ fetch: fetchFn }));

    expect(result).toEqual({ ok: false, reason: 'catalog offline' });
    expect(mockDeleteResource).toHaveBeenCalledTimes(1);
    expect(mockDeleteResource).toHaveBeenCalledWith({ containerUri: trashItemContainerUri, fetch: fetchFn });
  });

  it('leaves the trash copy intact and returns the failure when the original delete fails', async () => {
    mockDeleteResource.mockResolvedValueOnce({ ok: false, reason: '403 Forbidden' });
    const result = await softDeleteFolder(softDeleteArgs());

    expect(result).toEqual({ ok: false, reason: '403 Forbidden' });
    expect(mockDeleteResource).toHaveBeenCalledTimes(1);
    expect(mockNotifyCatalogChanged).not.toHaveBeenCalled();
  });
});

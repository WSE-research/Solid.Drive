import { describe, it, expect, vi, beforeEach } from 'vitest';
import { softDeleteFile } from '../softDeleteFile-file/softDeleteFile';
import type { FetchFn } from '@/types/solid';
import type { SharedEntry } from '@/types/sharing';

const mockAppendToCatalog = vi.fn().mockResolvedValue(undefined);
vi.mock('@/infrastructure/solid/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infrastructure/solid/catalog')>();
  return { ...actual, appendToCatalog: (...args: unknown[]) => mockAppendToCatalog(...args) };
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

const containerUri = 'https://pod.example/my-solid-app/photo-2024/';
const storageRootUri = 'https://pod.example/';
const catalogUri = 'https://pod.example/catalog.ttl';
const ownerWebId = 'https://owner.example/#me';
const trashItemContainerUri = 'https://pod.example/trash/abc123/';
const trashCatalogUri = 'https://pod.example/trash/catalog.ttl';
const sourceBinaryUri = `${containerUri}photo.jpg`;

const baseEntry: SharedEntry = {
  metadataUri: `${containerUri}index.ttl`,
  binaryUri: sourceBinaryUri,
  classUri: 'http://schema.org/ImageObject',
  mediaType: 'image/jpeg',
  byteSize: 12345,
  title: 'photo',
  description: 'a photo',
  modified: '2026-01-01T00:00:00.000Z',
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

function makeFetch(overrides: Record<string, Response> = {}): ReturnType<typeof vi.fn<FetchFn>> {
  return vi.fn<FetchFn>(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const key = `${method} ${url}`;
    if (overrides[key]) return overrides[key];
    if (overrides[url]) return overrides[url];
    if (method === 'HEAD' && (url === sourceBinaryUri || url === containerUri)) return okResponse();
    if (method === 'PUT') return okResponse('', undefined);
    if (url === sourceBinaryUri) return okResponse('binary-data', 'image/jpeg');
    if (url === `${containerUri}index.ttl`) return okResponse('<> a <#Dataset> .', 'text/turtle');
    return errorResponse(404, 'Not Found');
  });
}

function softDeleteArgs(overrides: Partial<Parameters<typeof softDeleteFile>[0]> = {}) {
  return {
    containerUri,
    storageRootUri,
    catalogUri,
    entry: baseEntry,
    ownerWebId,
    fetch: makeFetch(),
    now: new Date('2026-01-15T00:00:00.000Z'),
    uniqueSuffix: 'abc123',
    ...overrides,
  };
}

describe('softDeleteFile', () => {
  beforeEach(() => {
    mockAppendToCatalog.mockClear().mockResolvedValue(undefined);
    mockSnapshotAcl.mockClear().mockResolvedValue(true);
    mockCheckHasPermission.mockClear().mockResolvedValue(true);
    mockDeleteResource.mockClear().mockResolvedValue({ ok: true });
    mockNotifyCatalogChanged.mockClear();
  });

  it('follows the copy-then-delete sequence and returns the trash container URI', async () => {
    const fetchFn = makeFetch();
    const result = await softDeleteFile(softDeleteArgs({ fetch: fetchFn }));

    expect(result).toEqual({ ok: true, trashItemContainerUri });

    const puts = fetchFn.mock.calls
      .filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
      .map(([url]) => String(url));
    expect(puts).toEqual([
      'https://pod.example/trash/',
      trashItemContainerUri,
      `${trashItemContainerUri}payload`,
      `${trashItemContainerUri}index.ttl`,
      `${trashItemContainerUri}tombstone.ttl`,
    ]);
  });

  it('checks the file is present and the agent has permission before touching anything', async () => {
    const fetchFn = makeFetch();
    await softDeleteFile(softDeleteArgs({ fetch: fetchFn }));

    expect(fetchFn).toHaveBeenCalledWith(sourceBinaryUri, { method: 'HEAD' });
    expect(mockCheckHasPermission).toHaveBeenCalledWith(sourceBinaryUri, containerUri, expect.any(Function));
  });

  it('fails cleanly without writing anything when the file is no longer present', async () => {
    const fetchFn = makeFetch({ [`HEAD ${sourceBinaryUri}`]: errorResponse(404, 'Not Found') });
    const result = await softDeleteFile(softDeleteArgs({ fetch: fetchFn }));

    expect(result).toEqual({ ok: false, reason: 'File is not present in the active area' });
    expect(mockDeleteResource).not.toHaveBeenCalled();
    expect(fetchFn.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')).toBe(false);
  });

  it('fails cleanly without writing anything when the agent lacks permission', async () => {
    mockCheckHasPermission.mockResolvedValueOnce(false);
    const fetchFn = makeFetch();
    const result = await softDeleteFile(softDeleteArgs({ fetch: fetchFn }));

    expect(result).toEqual({ ok: false, reason: 'Missing permission to delete this file' });
    expect(mockDeleteResource).not.toHaveBeenCalled();
    expect(fetchFn.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')).toBe(false);
  });

  it('snapshots the ACL of the original container into the trash item container', async () => {
    await softDeleteFile(softDeleteArgs());
    expect(mockSnapshotAcl).toHaveBeenCalledWith(
      containerUri,
      `${trashItemContainerUri}acl-snapshot.ttl`,
      expect.any(Function),
    );
  });

  it('appends the trash catalog entry pointing at the fixed-name payload copy', async () => {
    await softDeleteFile(softDeleteArgs());
    expect(mockAppendToCatalog).toHaveBeenCalledWith({
      catalogUri: trashCatalogUri,
      instanceUri: `${trashItemContainerUri}index.ttl`,
      binaryUri: `${trashItemContainerUri}payload`,
      classUri: baseEntry.classUri,
      parentUri: "",
      mediaType: baseEntry.mediaType,
      byteSize: baseEntry.byteSize,
      title: baseEntry.title,
      description: baseEntry.description,
      modified: baseEntry.modified,
      publisherWebId: ownerWebId,
      fetch: expect.any(Function),
    });
  });

  it('removes the original file with exactly the expected container, catalog, and metadata info', async () => {
    await softDeleteFile(softDeleteArgs());
    expect(mockDeleteResource).toHaveBeenCalledWith({
      containerUri,
      metadataUri: baseEntry.metadataUri,
      catalogUri,
      fetch: expect.any(Function),
    });
  });

  it('writes a tombstone recording the original binary name, not "payload"', async () => {
    const fetchFn = makeFetch();
    await softDeleteFile(softDeleteArgs({ fetch: fetchFn, retentionDays: 10 }));

    const tombstonePut = fetchFn.mock.calls.find(
      ([url, init]) => url === `${trashItemContainerUri}tombstone.ttl` && (init as RequestInit | undefined)?.method === 'PUT',
    );
    const body = String((tombstonePut![1] as RequestInit).body);
    expect(body).toContain('2026-01-15T00:00:00.000Z');
    expect(body).toContain('2026-01-25T00:00:00.000Z');
    expect(body).toContain(containerUri);
    expect(body).toContain(catalogUri);
    expect(body).toContain(baseEntry.metadataUri);
    expect(body).toContain('photo.jpg');
    expect(body).toContain(baseEntry.classUri);
  });

  it('records the entry\'s parent folder in the tombstone, so restore can put it back where it was', async () => {
    const entry: SharedEntry = { ...baseEntry, parentUri: 'https://pod.example/my-solid-app/' };
    const fetchFn = makeFetch();
    await softDeleteFile(softDeleteArgs({ entry, fetch: fetchFn }));

    const tombstonePut = fetchFn.mock.calls.find(
      ([url, init]) => url === `${trashItemContainerUri}tombstone.ttl` && (init as RequestInit | undefined)?.method === 'PUT',
    );
    const body = String((tombstonePut![1] as RequestInit).body);
    expect(body).toContain(entry.parentUri);
  });

  it('notifies listeners that the trash catalog changed, on success', async () => {
    await softDeleteFile(softDeleteArgs());
    expect(mockNotifyCatalogChanged).toHaveBeenCalledWith(trashCatalogUri);
  });

  it('still succeeds and records no ACL snapshot when the resource has none to begin with', async () => {
    mockSnapshotAcl.mockResolvedValueOnce(false);
    const fetchFn = makeFetch();
    const result = await softDeleteFile(softDeleteArgs({ fetch: fetchFn }));

    expect(result.ok).toBe(true);
    const tombstonePut = fetchFn.mock.calls.find(
      ([url, init]) => url === `${trashItemContainerUri}tombstone.ttl` && (init as RequestInit | undefined)?.method === 'PUT',
    );
    // N3's Writer emits xsd:boolean in its canonical unquoted form (`false`, not `"false"`).
    expect(String((tombstonePut![1] as RequestInit).body)).toContain('hasAclSnapshot> false');
  });

  it('still succeeds and records no ACL snapshot when reading the ACL fails', async () => {
    mockSnapshotAcl.mockRejectedValueOnce(new Error('acl unreadable'));
    const result = await softDeleteFile(softDeleteArgs());
    expect(result.ok).toBe(true);
    expect(mockDeleteResource).toHaveBeenCalledTimes(1);
  });

  it('rolls back the trash copy and does not touch the original when the binary copy fails', async () => {
    const fetchFn = makeFetch({ [`GET ${sourceBinaryUri}`]: errorResponse(500, 'Server Error') });
    const result = await softDeleteFile(softDeleteArgs({ fetch: fetchFn }));

    expect(result).toEqual({ ok: false, reason: expect.stringContaining('500') });
    expect(mockDeleteResource).toHaveBeenCalledTimes(1);
    expect(mockDeleteResource).toHaveBeenCalledWith({ containerUri: trashItemContainerUri, fetch: fetchFn });
  });

  it('rolls back the trash copy and does not touch the original when saving the trash catalog entry fails', async () => {
    mockAppendToCatalog.mockRejectedValueOnce(new Error('catalog offline'));
    const fetchFn = makeFetch();
    const result = await softDeleteFile(softDeleteArgs({ fetch: fetchFn }));

    expect(result).toEqual({ ok: false, reason: 'catalog offline' });
    expect(mockDeleteResource).toHaveBeenCalledTimes(1);
    expect(mockDeleteResource).toHaveBeenCalledWith({ containerUri: trashItemContainerUri, fetch: fetchFn });
  });

  it('leaves the trash copy intact and returns the failure when the original delete fails', async () => {
    mockDeleteResource.mockResolvedValueOnce({ ok: false, reason: '403 Forbidden' });
    const result = await softDeleteFile(softDeleteArgs());

    expect(result).toEqual({ ok: false, reason: '403 Forbidden' });
    expect(mockDeleteResource).toHaveBeenCalledTimes(1);
    expect(mockNotifyCatalogChanged).not.toHaveBeenCalled();
  });

  it('falls back to listing the container\'s contents when the entry has no binary URL, skipping nested containers', async () => {
    const entry: SharedEntry = { ...baseEntry, binaryUri: '' };
    const fetchFn = vi.fn<FetchFn>(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'HEAD' && (url === sourceBinaryUri || url === containerUri)) return okResponse();
      if (method === 'PUT') return okResponse('', undefined);
      if (url === containerUri) {
        return okResponse(
          turtleWithChildren(containerUri, [`${containerUri}sub/`, sourceBinaryUri, `${containerUri}index.ttl`]),
          'text/turtle',
        );
      }
      if (url === sourceBinaryUri) return okResponse('binary-data', 'image/jpeg');
      if (url === `${containerUri}index.ttl`) return okResponse('<> a <#Dataset> .', 'text/turtle');
      return errorResponse(404, 'Not Found');
    });

    const result = await softDeleteFile(softDeleteArgs({ entry, fetch: fetchFn }));

    expect(result).toEqual({ ok: true, trashItemContainerUri });
    expect(mockAppendToCatalog).toHaveBeenCalledWith(
      expect.objectContaining({
        catalogUri: trashCatalogUri,
        instanceUri: expect.any(String),
        binaryUri: `${trashItemContainerUri}payload`,
        fetch: expect.any(Function),
      }),
    );
  });

  it('falls back to listing the container\'s contents when the entry\'s binary URL is actually the container itself', async () => {
    const entry: SharedEntry = { ...baseEntry, binaryUri: containerUri };
    const fetchFn = vi.fn<FetchFn>(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'HEAD' && (url === sourceBinaryUri || url === containerUri)) return okResponse();
      if (method === 'PUT') return okResponse('', undefined);
      if (url === containerUri) {
        return okResponse(
          turtleWithChildren(containerUri, [sourceBinaryUri, `${containerUri}index.ttl`]),
          'text/turtle',
        );
      }
      if (url === sourceBinaryUri) return okResponse('binary-data', 'image/jpeg');
      if (url === `${containerUri}index.ttl`) return okResponse('<> a <#Dataset> .', 'text/turtle');
      return errorResponse(404, 'Not Found');
    });

    const result = await softDeleteFile(softDeleteArgs({ entry, fetch: fetchFn }));

    expect(result).toEqual({ ok: true, trashItemContainerUri });
    expect(mockAppendToCatalog).toHaveBeenCalledWith(
      expect.objectContaining({
        catalogUri: trashCatalogUri,
        instanceUri: expect.any(String),
        binaryUri: `${trashItemContainerUri}payload`,
        fetch: expect.any(Function),
      }),
    );
  });

  it('fails cleanly when no binary payload can be located', async () => {
    const entry: SharedEntry = { ...baseEntry, binaryUri: '' };
    const fetchFn = vi.fn<FetchFn>(async (input, init) => {
      const url = String(input);
      if ((init?.method ?? 'GET') === 'PUT') return okResponse('', undefined);
      if (url === containerUri) return okResponse(turtleWithChildren(containerUri, [`${containerUri}index.ttl`]), 'text/turtle');
      return errorResponse(404, 'Not Found');
    });

    const result = await softDeleteFile(softDeleteArgs({ entry, fetch: fetchFn }));

    expect(result).toEqual({ ok: false, reason: "Could not locate the file's binary payload" });
    expect(mockDeleteResource).not.toHaveBeenCalled();
  });

  it('still succeeds when no clock or trash-item ID is explicitly given', async () => {
    const result = await softDeleteFile({
      containerUri,
      storageRootUri,
      catalogUri,
      entry: baseEntry,
      ownerWebId,
      fetch: makeFetch(),
    });
    expect(result.ok).toBe(true);
  });

  it('reports "Unknown error" when a non-Error value is thrown mid-sequence', async () => {
    mockAppendToCatalog.mockRejectedValueOnce('plain string failure');
    const result = await softDeleteFile(softDeleteArgs());
    expect(result).toEqual({ ok: false, reason: 'Unknown error' });
  });

  it('falls back to the folder name and the given timestamp when the title, type, format, and modified date are all empty', async () => {
    const entry: SharedEntry = { ...baseEntry, classUri: '', mediaType: '', title: '', modified: '' };
    await softDeleteFile(softDeleteArgs({ entry }));

    expect(mockAppendToCatalog).toHaveBeenCalledWith({
      catalogUri: trashCatalogUri,
      instanceUri: expect.any(String),
      binaryUri: expect.any(String),
      classUri: 'http://schema.org/DigitalDocument',
      parentUri: "",
      mediaType: 'application/octet-stream',
      byteSize: baseEntry.byteSize,
      title: 'photo-2024',
      description: baseEntry.description,
      modified: '2026-01-15T00:00:00.000Z',
      publisherWebId: ownerWebId,
      fetch: expect.any(Function),
    });
  });
});

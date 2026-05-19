import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteResource } from '../deleteResource-file/deleteResource';
import type { FetchFn } from '@/types/solid';

const mockRemoveFromCatalog = vi.fn().mockResolvedValue(undefined);
vi.mock('@/infrastructure/solid/catalog', () => ({
  removeFromCatalog: (...args: unknown[]) => mockRemoveFromCatalog(...args),
}));

const turtleWithChildren = (containerUri: string, children: string[]): string =>
  [
    '@prefix ldp: <http://www.w3.org/ns/ldp#> .',
    `<${containerUri}> ${children.map((child) => `ldp:contains <${child}>`).join(' ; ')} .`,
  ].join('\n');

const okResponse = (body = ''): Response =>
  new Response(body, { status: 200, statusText: 'OK' });

const errorResponse = (status: number, statusText: string): Response =>
  new Response('', { status, statusText });

describe('deleteResource', () => {
  beforeEach(() => {
    mockRemoveFromCatalog.mockClear();
    mockRemoveFromCatalog.mockResolvedValue(undefined);
  });

  it('deletes every child via DELETE then deletes the container itself', async () => {
    const containerUri = 'https://pod/app/file/';
    const childBinary = 'https://pod/app/file/binary.pdf';
    const childIndex = 'https://pod/app/file/index.ttl';
    const calls: Array<{ url: string; method: string }> = [];
    const fetchFn = vi.fn<FetchFn>(async (input, init) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? 'GET' });
      if (init?.method === 'DELETE') return okResponse();
      if (url === containerUri)
        return okResponse(turtleWithChildren(containerUri, [childBinary, childIndex]));
      return errorResponse(404, 'Not Found');
    });

    const result = await deleteResource({ containerUri, fetch: fetchFn });

    expect(result).toEqual({ ok: true });
    const deletes = calls.filter((call) => call.method === 'DELETE').map((call) => call.url);
    // Each DELETE is preceded by a best-effort drop of the companion .acl.
    expect(deletes).toEqual([
      `${childBinary}.acl`,
      childBinary,
      `${childIndex}.acl`,
      childIndex,
      `${containerUri}.acl`,
      containerUri,
    ]);
  });

  it('drops the companion .acl before the container DELETE', async () => {
    const containerUri = 'https://pod/app/file/';
    const aclUri = `${containerUri}.acl`;
    const deletes: string[] = [];
    const fetchFn = vi.fn<FetchFn>(async (input, init) => {
      const url = String(input);
      if (init?.method === 'DELETE') {
        deletes.push(url);
        return okResponse();
      }
      return okResponse('');
    });

    await deleteResource({ containerUri, fetch: fetchFn });

    expect(deletes).toContain(aclUri);
    expect(deletes.indexOf(aclUri)).toBeLessThan(deletes.indexOf(containerUri));
  });

  it('ignores a failing .acl DELETE so the resource DELETE still runs', async () => {
    const containerUri = 'https://pod/app/file/';
    const aclUri = `${containerUri}.acl`;
    const fetchFn = vi.fn<FetchFn>(async (input, init) => {
      const url = String(input);
      if (init?.method === 'DELETE' && url === aclUri) {
        throw new Error('network down');
      }
      if (init?.method === 'DELETE') return okResponse();
      return okResponse('');
    });

    const result = await deleteResource({ containerUri, fetch: fetchFn });

    expect(result).toEqual({ ok: true });
  });

  it('removes the catalog entry when catalogUri + metadataUri are provided', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => okResponse(''));
    await deleteResource({
      containerUri: 'https://pod/app/file/',
      metadataUri: 'https://pod/app/file/index.ttl',
      catalogUri: 'https://pod/catalog',
      fetch: fetchFn,
    });
    expect(mockRemoveFromCatalog).toHaveBeenCalledWith(
      'https://pod/catalog',
      'https://pod/app/file/index.ttl',
      fetchFn,
    );
  });

  it('continues even when removeFromCatalog rejects', async () => {
    mockRemoveFromCatalog.mockRejectedValue(new Error('catalog offline'));
    const fetchFn = vi.fn<FetchFn>(async () => okResponse(''));
    const result = await deleteResource({
      containerUri: 'https://pod/app/file/',
      metadataUri: 'https://pod/app/file/index.ttl',
      catalogUri: 'https://pod/catalog',
      fetch: fetchFn,
    });
    expect(result).toEqual({ ok: true });
  });

  it('recurses into nested containers', async () => {
    const root = 'https://pod/app/folder/';
    const sub = 'https://pod/app/folder/sub/';
    const leaf = 'https://pod/app/folder/sub/leaf.txt';
    const fetchFn = vi.fn<FetchFn>(async (input, init) => {
      const url = String(input);
      if (init?.method === 'DELETE') return okResponse();
      if (url === root) return okResponse(turtleWithChildren(root, [sub]));
      if (url === sub) return okResponse(turtleWithChildren(sub, [leaf]));
      return errorResponse(404, 'Not Found');
    });

    const result = await deleteResource({ containerUri: root, fetch: fetchFn });

    expect(result).toEqual({ ok: true });
    const deletes = fetchFn.mock.calls
      .filter(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')
      .map(([url]) => url);
    expect(deletes).toEqual([
      `${leaf}.acl`,
      leaf,
      `${sub}.acl`,
      sub,
      `${root}.acl`,
      root,
    ]);
  });

  it('returns { ok: false, reason } with a child failure', async () => {
    const containerUri = 'https://pod/app/file/';
    const child = 'https://pod/app/file/locked.pdf';
    const fetchFn = vi.fn<FetchFn>(async (input, init) => {
      const url = String(input);
      if (init?.method === 'DELETE') {
        return url === child ? errorResponse(403, 'Forbidden') : okResponse();
      }
      return okResponse(turtleWithChildren(containerUri, [child]));
    });

    const result = await deleteResource({ containerUri, fetch: fetchFn });
    expect(result).toEqual({ ok: false, reason: `${child}: 403 Forbidden` });
  });

  it('returns { ok: false, reason } when the container DELETE fails', async () => {
    const containerUri = 'https://pod/app/file/';
    const fetchFn = vi.fn<FetchFn>(async (input, init) => {
      const url = String(input);
      if (init?.method === 'DELETE' && url === containerUri)
        return errorResponse(409, 'Conflict');
      if (init?.method === 'DELETE') return okResponse();
      return okResponse('');
    });

    const result = await deleteResource({ containerUri, fetch: fetchFn });
    expect(result).toEqual({ ok: false, reason: '409 Conflict' });
  });

  it('tolerates a 404 from the container delete (already gone)', async () => {
    const containerUri = 'https://pod/app/file/';
    const fetchFn = vi.fn<FetchFn>(async (_input, init) => {
      if (init?.method === 'DELETE') return errorResponse(404, 'Not Found');
      return okResponse('');
    });

    const result = await deleteResource({ containerUri, fetch: fetchFn });
    expect(result).toEqual({ ok: true });
  });

  it('returns { ok: false, reason } when fetch throws', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => {
      throw new Error('offline');
    });

    const result = await deleteResource({
      containerUri: 'https://pod/app/file/',
      fetch: fetchFn,
    });
    expect(result).toEqual({ ok: false, reason: 'offline' });
  });

  it('treats a non-2xx GET on the container as empty children and still deletes the parent', async () => {
    const containerUri = 'https://pod/app/file/';
    const fetchFn = vi.fn<FetchFn>(async (_input, init) => {
      if (init?.method === 'DELETE') return okResponse();
      return errorResponse(403, 'Forbidden');
    });

    const result = await deleteResource({ containerUri, fetch: fetchFn });
    expect(result).toEqual({ ok: true });
  });

  it('propagates a nested child container failure up to the top caller', async () => {
    const root = 'https://pod/app/folder/';
    const sub = 'https://pod/app/folder/sub/';
    const leaf = 'https://pod/app/folder/sub/locked.pdf';
    const fetchFn = vi.fn<FetchFn>(async (input, init) => {
      const url = String(input);
      if (init?.method === 'DELETE') {
        return url === leaf ? errorResponse(403, 'Forbidden') : okResponse();
      }
      if (url === root) return okResponse(turtleWithChildren(root, [sub]));
      if (url === sub) return okResponse(turtleWithChildren(sub, [leaf]));
      return errorResponse(404, 'Not Found');
    });

    const result = await deleteResource({ containerUri: root, fetch: fetchFn });
    expect(result).toEqual({ ok: false, reason: `${leaf}: 403 Forbidden` });
  });

  it('returns "Unknown error" when fetch throws a non-Error value', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => {
      throw 'plain string failure';
    });

    const result = await deleteResource({
      containerUri: 'https://pod/app/file/',
      fetch: fetchFn,
    });
    expect(result).toEqual({ ok: false, reason: 'Unknown error' });
  });
});

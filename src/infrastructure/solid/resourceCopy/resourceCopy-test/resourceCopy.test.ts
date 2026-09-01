import { describe, it, expect, vi } from 'vitest';
import { copyResource, ensureContainer, copyContainerTree } from '../resourceCopy-file/resourceCopy';
import type { FetchFn } from '@/types/solid';

const turtleWithChildren = (containerUri: string, children: string[]): string =>
  [
    '@prefix ldp: <http://www.w3.org/ns/ldp#> .',
    `<${containerUri}> ${children.map((child) => `ldp:contains <${child}>`).join(' ; ')} .`,
  ].join('\n');

describe('copyResource', () => {
  const sourceUri = 'https://pod.example/app/file/photo.jpg';
  const targetUri = 'https://pod.example/app/trash/photo-abc/photo.jpg';

  it('GETs the source and PUTs the body to the target with the source content type', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchFn = vi.fn<FetchFn>(async (input, init) => {
      calls.push({ url: String(input), init });
      if (!init) return new Response('binary-data', { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
      return new Response('', { status: 201 });
    });

    await copyResource(sourceUri, targetUri, fetchFn);

    expect(calls[0]).toEqual({ url: sourceUri, init: undefined });
    expect(calls[1].url).toBe(targetUri);
    expect(calls[1].init?.method).toBe('PUT');
    expect((calls[1].init?.headers as Record<string, string>)['Content-Type']).toBe('image/jpeg');
  });

  // A string Response body auto-sets `Content-Type: text/plain`, so a
  // headerless source response is simulated with a raw byte body instead.
  const responseWithNoContentType = () => new Response(new Uint8Array([1, 2, 3]), { status: 200 });

  it('falls back to the provided content type when the source has none', async () => {
    const fetchFn = vi.fn<FetchFn>(async (_input, init) => {
      if (!init) return responseWithNoContentType();
      return new Response('', { status: 201 });
    });

    await copyResource(sourceUri, targetUri, fetchFn, 'text/turtle');

    const putInit = fetchFn.mock.calls[1][1] as RequestInit;
    expect((putInit.headers as Record<string, string>)['Content-Type']).toBe('text/turtle');
  });

  it('falls back to octet-stream when neither the source header nor a fallback is available', async () => {
    const fetchFn = vi.fn<FetchFn>(async (_input, init) => {
      if (!init) return responseWithNoContentType();
      return new Response('', { status: 201 });
    });

    await copyResource(sourceUri, targetUri, fetchFn);

    const putInit = fetchFn.mock.calls[1][1] as RequestInit;
    expect((putInit.headers as Record<string, string>)['Content-Type']).toBe('application/octet-stream');
  });

  it('throws when the GET fails', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => new Response('', { status: 404, statusText: 'Not Found' }));
    await expect(copyResource(sourceUri, targetUri, fetchFn)).rejects.toThrow('404');
  });

  it('throws when the PUT fails', async () => {
    const fetchFn = vi.fn<FetchFn>(async (_input, init) => {
      if (!init) return new Response('data', { status: 200 });
      return new Response('', { status: 403, statusText: 'Forbidden' });
    });
    await expect(copyResource(sourceUri, targetUri, fetchFn)).rejects.toThrow('403');
  });
});

describe('ensureContainer', () => {
  const containerUri = 'https://pod.example/app/trash/';

  it('PUTs an empty turtle body to the container', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => new Response('', { status: 201 }));
    await ensureContainer(containerUri, fetchFn);
    expect(fetchFn).toHaveBeenCalledWith(containerUri, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/turtle' },
      body: '',
    });
  });

  it('tolerates 409 (already exists)', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => new Response('', { status: 409, statusText: 'Conflict' }));
    await expect(ensureContainer(containerUri, fetchFn)).resolves.toBeUndefined();
  });

  it('throws on other failures', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => new Response('', { status: 500, statusText: 'Server Error' }));
    await expect(ensureContainer(containerUri, fetchFn)).rejects.toThrow('500');
  });
});

describe('copyContainerTree', () => {
  const sourceRoot = 'https://pod.example/app/folder/';
  const targetRoot = 'https://pod.example/trash/abc/payload/';

  it('mirrors a flat container of leaves to the target root', async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const fetchFn = vi.fn<FetchFn>(async (input, init) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? 'GET' });
      if (init?.method === 'PUT') return new Response('', { status: 201 });
      if (url === sourceRoot) {
        return new Response(turtleWithChildren(sourceRoot, [`${sourceRoot}a.txt`, `${sourceRoot}b.txt`]), {
          status: 200,
          headers: { 'Content-Type': 'text/turtle' },
        });
      }
      return new Response('leaf-body', { status: 200 });
    });

    await copyContainerTree(sourceRoot, targetRoot, fetchFn);

    const puts = calls.filter((call) => call.method === 'PUT').map((call) => call.url);
    expect(puts).toEqual([targetRoot, `${targetRoot}a.txt`, `${targetRoot}b.txt`]);
  });

  it('recurses into nested containers, mirroring the same relative structure', async () => {
    const sub = `${sourceRoot}sub/`;
    const fetchFn = vi.fn<FetchFn>(async (input, init) => {
      const url = String(input);
      if (init?.method === 'PUT') return new Response('', { status: 201 });
      if (url === sourceRoot) return new Response(turtleWithChildren(sourceRoot, [sub]), { status: 200 });
      if (url === sub) return new Response(turtleWithChildren(sub, [`${sub}nested.txt`]), { status: 200 });
      return new Response('leaf-body', { status: 200 });
    });

    await copyContainerTree(sourceRoot, targetRoot, fetchFn);

    const putUrls = fetchFn.mock.calls
      .filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
      .map(([url]) => String(url));
    expect(putUrls).toEqual([targetRoot, `${targetRoot}sub/`, `${targetRoot}sub/nested.txt`]);
  });

  it('creates just the target root when the source has no children', async () => {
    const fetchFn = vi.fn<FetchFn>(async (_input, init) => {
      if (init?.method === 'PUT') return new Response('', { status: 201 });
      return new Response('', { status: 404 });
    });

    await copyContainerTree(sourceRoot, targetRoot, fetchFn);

    expect(fetchFn).toHaveBeenCalledWith(targetRoot, expect.objectContaining({ method: 'PUT' }));
    const putCalls = fetchFn.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT');
    expect(putCalls).toHaveLength(1);
  });

  it('propagates a failure copying a leaf', async () => {
    const fetchFn = vi.fn<FetchFn>(async (input, init) => {
      const url = String(input);
      if (init?.method === 'PUT' && url === targetRoot) return new Response('', { status: 201 });
      if (url === sourceRoot) return new Response(turtleWithChildren(sourceRoot, [`${sourceRoot}a.txt`]), { status: 200 });
      if (url === `${sourceRoot}a.txt`) return new Response('', { status: 403, statusText: 'Forbidden' });
      return new Response('', { status: 500 });
    });

    await expect(copyContainerTree(sourceRoot, targetRoot, fetchFn)).rejects.toThrow('403');
  });

  it('refuses to loop forever when a malformed listing cycles a container back to itself', async () => {
    // sub lists itself as its own child — malformed data, but the walk must
    // still stop instead of recursing until the stack overflows.
    const sub = `${sourceRoot}sub/`;
    const fetchFn = vi.fn<FetchFn>(async (input, init) => {
      const url = String(input);
      if (init?.method === 'PUT') return new Response('', { status: 201 });
      if (url === sourceRoot) return new Response(turtleWithChildren(sourceRoot, [sub]), { status: 200 });
      if (url === sub) return new Response(turtleWithChildren(sub, [sub]), { status: 200 });
      return new Response('', { status: 404 });
    });

    await expect(copyContainerTree(sourceRoot, targetRoot, fetchFn)).rejects.toThrow(/cycles/);
  });

  it('refuses to copy a listed child that isn\'t actually nested under its own container', async () => {
    // Malformed data: the source root's listing includes a URI that lives
    // entirely outside sourceRoot's own path.
    const strayUri = 'https://pod.example/somewhere-else/stray.txt';
    const fetchFn = vi.fn<FetchFn>(async (input, init) => {
      const url = String(input);
      if (init?.method === 'PUT') return new Response('', { status: 201 });
      if (url === sourceRoot) return new Response(turtleWithChildren(sourceRoot, [strayUri]), { status: 200 });
      return new Response('', { status: 404 });
    });

    await expect(copyContainerTree(sourceRoot, targetRoot, fetchFn)).rejects.toThrow(/nested under it/);
  });
});

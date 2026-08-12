import { describe, it, expect, vi } from 'vitest';
import { copyResource, ensureContainer } from '../resourceCopy-file/resourceCopy';
import type { FetchFn } from '@/types/solid';

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

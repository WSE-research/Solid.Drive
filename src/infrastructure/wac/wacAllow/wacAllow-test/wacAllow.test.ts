import { describe, it, expect, vi } from 'vitest';
import { parseWacAllowModes, checkHasPermission } from '../wacAllow-file/wacAllow';
import type { FetchFn } from '@/types/solid';

describe('parseWacAllowModes', () => {
  it('parses the modes granted to the user group', () => {
    expect(parseWacAllowModes('user="read write control",public="read"')).toEqual(
      new Set(['read', 'write', 'control']),
    );
  });

  it('returns an empty set when the header is null', () => {
    expect(parseWacAllowModes(null)).toEqual(new Set());
  });

  it('returns an empty set when there is no user group', () => {
    expect(parseWacAllowModes('public="read"')).toEqual(new Set());
  });

  it('returns an empty set for an empty user group', () => {
    expect(parseWacAllowModes('user=""')).toEqual(new Set());
  });

  it('ignores group order and whitespace around groups', () => {
    expect(parseWacAllowModes('public="read", user="write append"')).toEqual(new Set(['write', 'append']));
  });
});

describe('checkHasPermission', () => {
  const resourceUri = 'https://pod.example/app/file/photo.png';
  const containerUri = 'https://pod.example/app/file/';

  const makeFetch = (resourceHeader: string | null, containerHeader: string | null) =>
    vi.fn<FetchFn>(async (input) => {
      const url = String(input);
      const header = url === resourceUri ? resourceHeader : containerHeader;
      return new Response('', { status: 200, headers: header ? { 'WAC-Allow': header } : undefined });
    });

  it('grants permission when the resource has write+control and the container has write', async () => {
    const fetchFn = makeFetch('user="read write control"', 'user="read write"');
    expect(await checkHasPermission(resourceUri, containerUri, fetchFn)).toBe(true);
  });

  it('denies permission when the resource is missing control', async () => {
    const fetchFn = makeFetch('user="read write"', 'user="read write"');
    expect(await checkHasPermission(resourceUri, containerUri, fetchFn)).toBe(false);
  });

  it('denies permission when the resource is missing write', async () => {
    const fetchFn = makeFetch('user="read control"', 'user="read write"');
    expect(await checkHasPermission(resourceUri, containerUri, fetchFn)).toBe(false);
  });

  it('denies permission when the container is missing write', async () => {
    const fetchFn = makeFetch('user="read write control"', 'user="read"');
    expect(await checkHasPermission(resourceUri, containerUri, fetchFn)).toBe(false);
  });

  it('denies permission when the WAC-Allow header is absent', async () => {
    const fetchFn = makeFetch(null, null);
    expect(await checkHasPermission(resourceUri, containerUri, fetchFn)).toBe(false);
  });

  it('sends HEAD requests to both the resource and the container', async () => {
    const fetchFn = makeFetch('user="read write control"', 'user="read write"');
    await checkHasPermission(resourceUri, containerUri, fetchFn);

    expect(fetchFn).toHaveBeenCalledWith(resourceUri, { method: 'HEAD' });
    expect(fetchFn).toHaveBeenCalledWith(containerUri, { method: 'HEAD' });
  });
});

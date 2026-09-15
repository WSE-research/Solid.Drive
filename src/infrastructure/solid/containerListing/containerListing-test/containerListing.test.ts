import { describe, it, expect, vi } from 'vitest';
import { listContainerChildren } from '../containerListing-file/containerListing';
import type { FetchFn } from '@/types/solid';

const turtleWithChildren = (containerUri: string, children: string[]): string =>
  [
    '@prefix ldp: <http://www.w3.org/ns/ldp#> .',
    `<${containerUri}> ${children.map((child) => `ldp:contains <${child}>`).join(' ; ')} .`,
  ].join('\n');

describe('listContainerChildren', () => {
  it('returns the URI of every child listed in the container', async () => {
    const containerUri = 'https://pod.example/app/folder/';
    const children = ['https://pod.example/app/folder/a.txt', 'https://pod.example/app/folder/sub/'];
    const fetchFn = vi.fn<FetchFn>(async () => new Response(turtleWithChildren(containerUri, children), { status: 200 }));

    expect(await listContainerChildren(containerUri, fetchFn)).toEqual(children);
  });

  it('resolves a child listed by a relative URI against the container itself', async () => {
    const containerUri = 'https://pod.example/app/folder/';
    const turtle = '@prefix ldp: <http://www.w3.org/ns/ldp#> .\n<> ldp:contains <a.txt> .';
    const fetchFn = vi.fn<FetchFn>(async () => new Response(turtle, { status: 200 }));

    expect(await listContainerChildren(containerUri, fetchFn)).toEqual(['https://pod.example/app/folder/a.txt']);
  });

  it('returns an empty list for a non-2xx response', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => new Response('', { status: 403, statusText: 'Forbidden' }));
    expect(await listContainerChildren('https://pod.example/app/folder/', fetchFn)).toEqual([]);
  });

  it('returns an empty list for an empty container', async () => {
    const containerUri = 'https://pod.example/app/folder/';
    const fetchFn = vi.fn<FetchFn>(async () => new Response(`<${containerUri}> a <http://www.w3.org/ns/ldp#Container> .`, { status: 200 }));
    expect(await listContainerChildren(containerUri, fetchFn)).toEqual([]);
  });

  it('returns an empty list for a 2xx response with malformed Turtle', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => new Response('not valid turtle @@@ <<<', { status: 200 }));
    expect(await listContainerChildren('https://pod.example/app/folder/', fetchFn)).toEqual([]);
  });

  it('requests the container with an Accept: text/turtle header', async () => {
    const containerUri = 'https://pod.example/app/folder/';
    const fetchFn = vi.fn<FetchFn>(async () => new Response('', { status: 200 }));
    await listContainerChildren(containerUri, fetchFn);
    expect(fetchFn).toHaveBeenCalledWith(containerUri, { headers: { Accept: 'text/turtle' } });
  });
});

import { describe, it, expect, vi } from 'vitest';
import { readTrashCatalogSnapshot, readTrashFolderContents, summarizeTrashFolder, writeCatalogEntry } from '../catalogSnapshot-file/catalogSnapshot';
import { FOLDER_CLASS_URI, parseCatalog } from '@/infrastructure/solid/catalog';
import type { CatalogEntry } from '@/types';
import type { FetchFn } from '@/types/solid';

const turtleWithChildren = (containerUri: string, children: string[]): string =>
  [
    '@prefix ldp: <http://www.w3.org/ns/ldp#> .',
    `<${containerUri}> ${children.map((child) => `ldp:contains <${child}>`).join(' ; ')} .`,
  ].join('\n');

const makeEntry = (overrides: Partial<CatalogEntry> & Pick<CatalogEntry, 'uri'>): CatalogEntry => ({
  conformsTo: '',
  title: '',
  description: '',
  modified: '',
  publisher: '',
  mediaType: '',
  byteSize: 0,
  accessURL: '',
  ...overrides,
});

describe('readTrashCatalogSnapshot', () => {
  const trashItemContainerUri = 'https://pod.example/trash/abc-123/';
  const snapshotUri = `${trashItemContainerUri}catalog-snapshot.ttl`;

  it('parses the snapshot at the trashed item\'s catalog-snapshot.ttl', async () => {
    const turtle = `
      @prefix dcat: <http://www.w3.org/ns/dcat#>.
      @prefix dcterms: <http://purl.org/dc/terms/>.
      <${snapshotUri}> a dcat:Catalog; dcat:dataset <https://pod.example/photos/beach.jpg/index.ttl>.
      <https://pod.example/photos/beach.jpg/index.ttl> a dcat:Dataset; dcterms:title "beach.jpg".
    `;
    const fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => turtle });

    const entries = await readTrashCatalogSnapshot(trashItemContainerUri, fetch);

    expect(fetch).toHaveBeenCalledWith(snapshotUri);
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('beach.jpg');
  });

  it('returns an empty list when the snapshot can\'t be fetched', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    expect(await readTrashCatalogSnapshot(trashItemContainerUri, fetch)).toEqual([]);
  });
});

describe('summarizeTrashFolder', () => {
  const root = 'https://pod.example/photos/';
  const subFolder = 'https://pod.example/photos/vacation/';
  const rootFile = 'https://pod.example/photos/beach.jpg/index.ttl';
  const subFile = 'https://pod.example/photos/vacation/sunset.jpg/index.ttl';

  it('excludes the root\'s own row and counts its files and folders separately', () => {
    const snapshot = [
      makeEntry({ uri: root, title: 'Photos', conformsTo: FOLDER_CLASS_URI }),
      makeEntry({ uri: subFolder, title: 'Vacation', conformsTo: FOLDER_CLASS_URI, parentUri: root }),
      makeEntry({ uri: rootFile, title: 'beach.jpg', parentUri: root }),
      makeEntry({ uri: subFile, title: 'sunset.jpg', parentUri: subFolder }),
    ];

    const result = summarizeTrashFolder(snapshot, root);

    expect(result.entries.map((entry) => entry.uri)).toEqual([subFolder, rootFile, subFile]);
    expect(result.fileCount).toBe(2);
    expect(result.folderCount).toBe(1);
  });

  it('reports zero counts for an empty snapshot', () => {
    expect(summarizeTrashFolder([], root)).toEqual({ entries: [], fileCount: 0, folderCount: 0 });
  });

  it('reports zero counts for a folder that had nothing in it', () => {
    const snapshot = [makeEntry({ uri: root, title: 'Photos', conformsTo: FOLDER_CLASS_URI })];
    expect(summarizeTrashFolder(snapshot, root)).toEqual({ entries: [], fileCount: 0, folderCount: 0 });
  });
});

describe('readTrashFolderContents', () => {
  const trashItemContainerUri = 'https://pod.example/trash/abc-123/';
  const snapshotUri = `${trashItemContainerUri}catalog-snapshot.ttl`;
  const payloadRootUri = `${trashItemContainerUri}payload/`;
  const originalRootUri = 'https://pod.example/photos/';

  function makeRouter(routes: Record<string, () => Response>): FetchFn {
    return vi.fn(async (url: RequestInfo) => {
      const handler = routes[String(url)];
      return handler ? handler() : new Response('', { status: 404 });
    });
  }

  const snapshotTurtle = (rootUri: string, entries: { uri: string; title: string; isFolder?: boolean }[]) => {
    const DCAT = 'http://www.w3.org/ns/dcat#';
    const DCTERMS = 'http://purl.org/dc/terms/';
    const lines = [`<${snapshotUri}> <${DCAT}dataset> <${rootUri}> .`, `<${rootUri}> <${DCTERMS}title> "root" .`];
    for (const entry of entries) {
      lines.push(`<${snapshotUri}> <${DCAT}dataset> <${entry.uri}> .`);
      lines.push(`<${entry.uri}> <${DCTERMS}title> "${entry.title}" .`);
      lines.push(`<${entry.uri}> <https://purl.org/solid-drive/catalog#hasParent> <${rootUri}> .`);
      if (entry.isFolder) lines.push(`<${entry.uri}> <${DCTERMS}conformsTo> <${FOLDER_CLASS_URI}> .`);
    }
    return lines.join('\n');
  };

  it('includes a bare file container the snapshot never recorded', async () => {
    const catalogued = `${originalRootUri}beach.jpg/`;
    const bare = `${originalRootUri}sunset.jpg/`;
    const fetch = makeRouter({
      [snapshotUri]: () => new Response(snapshotTurtle(originalRootUri, [{ uri: `${catalogued}index.ttl`, title: 'beach.jpg' }])),
      [payloadRootUri]: () => new Response(turtleWithChildren(payloadRootUri, [`${payloadRootUri}beach.jpg/`, `${payloadRootUri}sunset.jpg/`])),
      [`${payloadRootUri}sunset.jpg/`]: () => new Response(turtleWithChildren(`${payloadRootUri}sunset.jpg/`, [`${payloadRootUri}sunset.jpg/index.ttl`])),
    });

    const result = await readTrashFolderContents(trashItemContainerUri, originalRootUri, fetch);

    expect(result.entries.map((entry) => entry.uri)).toEqual(expect.arrayContaining([`${catalogued}index.ttl`, bare]));
    expect(result.fileCount).toBe(2);
    const bareEntry = result.entries.find((entry) => entry.uri === bare);
    expect(bareEntry?.title).toBe('sunset.jpg');
    // No catalog row means no dcterms:conformsTo — guessed from the
    // extension instead, so it doesn't render as a generic document tile.
    expect(bareEntry?.conformsTo).toBe('http://schema.org/ImageObject');
  });

  it('leaves conformsTo blank for a bare file whose extension isn\'t a recognized media type', async () => {
    const bare = `${originalRootUri}notes.txt/`;
    const fetch = makeRouter({
      [snapshotUri]: () => new Response('', { status: 404 }),
      [payloadRootUri]: () => new Response(turtleWithChildren(payloadRootUri, [`${payloadRootUri}notes.txt/`])),
      [`${payloadRootUri}notes.txt/`]: () => new Response(turtleWithChildren(`${payloadRootUri}notes.txt/`, [`${payloadRootUri}notes.txt/index.ttl`])),
    });

    const result = await readTrashFolderContents(trashItemContainerUri, originalRootUri, fetch);

    expect(result.entries.find((entry) => entry.uri === bare)?.conformsTo).toBe('');
  });

  it('does not duplicate an entry the snapshot already has, even though it\'s also in the payload listing', async () => {
    const catalogued = `${originalRootUri}beach.jpg/`;
    const fetch = makeRouter({
      [snapshotUri]: () => new Response(snapshotTurtle(originalRootUri, [{ uri: `${catalogued}index.ttl`, title: 'beach.jpg' }])),
      [payloadRootUri]: () => new Response(turtleWithChildren(payloadRootUri, [`${payloadRootUri}beach.jpg/`])),
    });

    const result = await readTrashFolderContents(trashItemContainerUri, originalRootUri, fetch);

    expect(result.entries).toHaveLength(1);
    expect(result.fileCount).toBe(1);
  });

  it('recurses into a bare folder (no index.ttl) to find nested bare content, but not into a bare file\'s own container', async () => {
    const bareFolder = `${payloadRootUri}extras/`;
    const nestedFile = `${payloadRootUri}extras/note.jpg/`;
    const fetch = makeRouter({
      [snapshotUri]: () => new Response('', { status: 404 }),
      [payloadRootUri]: () => new Response(turtleWithChildren(payloadRootUri, [bareFolder])),
      [bareFolder]: () => new Response(turtleWithChildren(bareFolder, [nestedFile])),
      [nestedFile]: () => new Response(turtleWithChildren(nestedFile, [`${nestedFile}index.ttl`])),
    });

    const result = await readTrashFolderContents(trashItemContainerUri, originalRootUri, fetch);

    expect(result.folderCount).toBe(1);
    expect(result.fileCount).toBe(1);
    const folderEntry = result.entries.find((entry) => entry.uri === `${originalRootUri}extras/`);
    const fileEntry = result.entries.find((entry) => entry.uri === `${originalRootUri}extras/note.jpg/`);
    expect(folderEntry).toBeDefined();
    expect(fileEntry?.parentUri).toBe(folderEntry?.uri);
  });

  it('degrades to the snapshot-only result when the payload listing fails, instead of throwing', async () => {
    const catalogued = `${originalRootUri}beach.jpg/`;
    const fetch = makeRouter({
      [snapshotUri]: () => new Response(snapshotTurtle(originalRootUri, [{ uri: `${catalogued}index.ttl`, title: 'beach.jpg' }])),
      // payloadRootUri intentionally unmocked -> 404
    });

    const result = await readTrashFolderContents(trashItemContainerUri, originalRootUri, fetch);

    expect(result.entries).toEqual([expect.objectContaining({ uri: `${catalogued}index.ttl` })]);
  });
});

describe('writeCatalogEntry', () => {
  const targetCatalogUri = 'https://pod.example/catalog.ttl';
  const publisherWebId = 'https://pod.example/profile/card#me';

  function capturingFetch() {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    const fetch = vi.fn(async (url: RequestInfo, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : undefined });
      if (init?.method === 'PUT') return { ok: true, status: 200, statusText: 'OK' } as Response;
      return { ok: false, status: 404, statusText: 'Not Found', text: async () => '' } as Response;
    });
    return { fetch, putBody: () => calls.find((call) => call.method === 'PUT')?.body ?? '' };
  }

  it('writes a folder entry via appendFolderToCatalog when the entry is a folder', async () => {
    const { fetch, putBody } = capturingFetch();
    const entry = makeEntry({
      uri: 'https://pod.example/photos/vacation/',
      title: 'Vacation',
      conformsTo: FOLDER_CLASS_URI,
      parentUri: 'https://pod.example/photos/',
      publisher: publisherWebId,
      modified: '2026-01-01T00:00:00.000Z',
    });

    await writeCatalogEntry(targetCatalogUri, entry, fetch);

    const [written] = parseCatalog(putBody(), targetCatalogUri);
    expect(written.uri).toBe(entry.uri);
    expect(written.title).toBe('Vacation');
    expect(written.parentUri).toBe(entry.parentUri);
  });

  it('writes a file entry via appendToCatalog when the entry is not a folder', async () => {
    const { fetch, putBody } = capturingFetch();
    const entry = makeEntry({
      uri: 'https://pod.example/photos/beach.jpg/index.ttl',
      title: 'beach.jpg',
      conformsTo: 'http://schema.org/ImageObject',
      accessURL: 'https://pod.example/photos/beach.jpg/beach.jpg',
      mediaType: 'image/jpeg',
      byteSize: 2048,
      parentUri: 'https://pod.example/photos/',
      publisher: publisherWebId,
      modified: '2026-01-01T00:00:00.000Z',
    });

    await writeCatalogEntry(targetCatalogUri, entry, fetch);

    const [written] = parseCatalog(putBody(), targetCatalogUri);
    expect(written.uri).toBe(entry.uri);
    expect(written.accessURL).toBe(entry.accessURL);
    expect(written.byteSize).toBe(2048);
  });
});

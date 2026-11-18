import { describe, it, expect, vi } from 'vitest';
import { Parser as N3Parser, Store as N3Store, Writer as N3Writer } from 'n3';
import type { Quad, Term } from 'n3';
import { appendTombstones, readTombstonedTags } from '@/infrastructure/solid/catalogTombstones';
import { parseCatalog } from '../catalog-file/catalog';
import type { FetchFn } from '@/types';

const SOLID = 'http://www.w3.org/ns/solid/terms#';
const STORAGE = 'https://pod.example/';
const PUBLISHER = 'https://pod.example/profile/card#me';

type ServerKind = 'n3-patch' | 'put-only';

/**
 * An in-memory Solid server with faithful concurrency semantics: every
 * write gets a new strong ETag, PUT honors If-Match and If-None-Match per
 * RFC 9110 (412 on mismatch), and, for 'n3-patch', N3 Patch is applied
 * atomically and answers 409 when a statement to delete is not present.
 * A 'put-only' server answers 405 to PATCH, like a server without N3 Patch.
 *
 * `beforeResponding` runs before a response is returned, so a test can
 * let another client complete a whole write in the middle of this one.
 */
class FakePod {
  private readonly docs = new Map<string, { text: string; version: number }>();
  private nextVersion = 1;
  beforeResponding: (method: string, url: string) => Promise<void> = async () => {};
  private readonly kind: ServerKind;

  constructor(kind: ServerKind) {
    this.kind = kind;
  }

  text(url: string): string {
    return this.docs.get(url)?.text ?? '';
  }

  private store(url: string, text: string): void {
    this.docs.set(url, { text, version: this.nextVersion++ });
  }

  readonly fetch: FetchFn = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const response = this.handle(url, method, (init?.headers as Record<string, string> | undefined) ?? {}, String(init?.body ?? ''));
    await this.beforeResponding(method, url);
    return response;
  };

  private handle(url: string, method: string, headers: Record<string, string>, body: string): Response {
    const doc = this.docs.get(url);
    const etag = doc ? `"v${doc.version}"` : null;
    if (method === 'GET' || method === 'HEAD') {
      if (!doc) return new Response(null, { status: 404, statusText: 'Not Found' });
      const responseHeaders: Record<string, string> = { 'Content-Type': 'text/turtle', ETag: etag! };
      if (this.kind === 'n3-patch') responseHeaders['Accept-Patch'] = 'text/n3, application/sparql-update';
      return new Response(method === 'HEAD' ? null : doc.text, { status: 200, headers: responseHeaders });
    }
    if (method === 'PUT') {
      const ifMatch = headers['If-Match'];
      if (ifMatch !== undefined && ifMatch !== '*' && (ifMatch.startsWith('W/') || ifMatch !== etag)) return new Response(null, { status: 412 });
      if (ifMatch === '*' && !doc) return new Response(null, { status: 412 });
      if (headers['If-None-Match'] === '*' && doc) return new Response(null, { status: 412 });
      this.store(url, body);
      return new Response(null, { status: doc ? 205 : 201 });
    }
    if (method === 'PATCH') {
      if (this.kind === 'put-only') return new Response(null, { status: 405, statusText: 'Method Not Allowed' });
      if (!doc) return new Response(null, { status: 404, statusText: 'Not Found' });
      return this.applyN3Patch(url, doc.text, body);
    }
    return new Response(null, { status: 405 });
  }

  private applyN3Patch(url: string, current: string, patch: string): Response {
    const patchQuads = new N3Parser({ format: 'text/n3', baseIRI: url }).parse(patch);
    const formula = (predicate: string): Term | undefined => patchQuads.find((q) => q.predicate.value === `${SOLID}${predicate}`)?.object;
    const inFormula = (graph: Term | undefined): Quad[] =>
      graph ? patchQuads.filter((q) => q.graph.equals(graph)).map((q) => new N3Store([q]).getQuads(q.subject, q.predicate, q.object, null)[0]) : [];
    const docStore = new N3Store(new N3Parser({ baseIRI: url }).parse(current));
    const deletes = inFormula(formula('deletes'));
    const inserts = inFormula(formula('inserts'));
    const present = (q: Quad) => docStore.countQuads(q.subject, q.predicate, q.object, null) > 0;
    if (!deletes.every(present)) return new Response(null, { status: 409, statusText: 'Conflict' });
    for (const q of deletes) docStore.removeQuads(docStore.getQuads(q.subject, q.predicate, q.object, null));
    for (const q of inserts) docStore.addQuad(q.subject, q.predicate, q.object);
    this.store(url, new N3Writer({ format: 'N-Triples' }).quadsToString(docStore.getQuads(null, null, null, null)));
    return new Response(null, { status: 205 });
  }
}

type CatalogModule = typeof import('../catalog-file/catalog');

/** A fresh module instance per client, so each has its own in-process write queue, like two apps. */
async function loadClient(): Promise<CatalogModule> {
  vi.resetModules();
  return import('../catalog-file/catalog');
}

function appendFile(client: CatalogModule, pod: FakePod, catalogUri: string, name: string) {
  return client.appendToCatalog({
    catalogUri,
    instanceUri: `${STORAGE}files/${name}/index.ttl`,
    binaryUri: `${STORAGE}files/${name}/${name}.txt`,
    classUri: 'http://schema.org/TextDigitalDocument',
    parentUri: `${STORAGE}files/`,
    mediaType: 'text/plain',
    byteSize: 1,
    title: name,
    description: '',
    modified: '2026-11-01T00:00:00.000Z',
    publisherWebId: PUBLISHER,
    fetch: pod.fetch,
  });
}

const instance = (name: string) => `${STORAGE}files/${name}/index.ttl`;
const rows = (pod: FakePod, catalogUri: string) => parseCatalog(pod.text(catalogUri), catalogUri).map((row) => row.uri).sort();

/** Runs `other` to completion right after `client` has read the catalog and before it writes. */
function interleaveAfterFirstRead(pod: FakePod, catalogUri: string, other: () => Promise<unknown>): void {
  let done = false;
  pod.beforeResponding = async (method, url) => {
    if (done || method !== 'GET' || url !== catalogUri) return;
    done = true;
    await other();
  };
}

describe.each(['n3-patch', 'put-only'] as const)('two concurrent catalog writers on a %s server', (kind) => {
  it.each([`${STORAGE}catalog.ttl`, `${STORAGE}trash/catalog.ttl`])('loses no row when both append to %s at once', async (catalogUri) => {
    const pod = new FakePod(kind);
    const [first, second] = [await loadClient(), await loadClient()];
    await appendFile(first, pod, catalogUri, 'existing');

    interleaveAfterFirstRead(pod, catalogUri, () => appendFile(second, pod, catalogUri, 'from-second'));
    await appendFile(first, pod, catalogUri, 'from-first');

    expect(rows(pod, catalogUri)).toEqual([instance('existing'), instance('from-first'), instance('from-second')].sort());
  });

  it('does not bring back a row that the other writer removed during an append', async () => {
    const catalogUri = `${STORAGE}catalog.ttl`;
    const pod = new FakePod(kind);
    const [appender, remover] = [await loadClient(), await loadClient()];
    await appendFile(appender, pod, catalogUri, 'kept');
    await appendFile(appender, pod, catalogUri, 'removed');

    interleaveAfterFirstRead(pod, catalogUri, () => remover.removeFromCatalog(catalogUri, instance('removed'), pod.fetch));
    await appendFile(appender, pod, catalogUri, 'appended');

    expect(rows(pod, catalogUri)).toEqual([instance('appended'), instance('kept')].sort());
  });

  it('does not lose a row that the other writer appended during a removal', async () => {
    const catalogUri = `${STORAGE}catalog.ttl`;
    const pod = new FakePod(kind);
    const [appender, remover] = [await loadClient(), await loadClient()];
    await appendFile(appender, pod, catalogUri, 'kept');
    await appendFile(appender, pod, catalogUri, 'removed');

    let reads = 0;
    pod.beforeResponding = async (method, url) => {
      // The remover's first GET of the catalog itself (after its HEAD).
      if (method === 'GET' && url === catalogUri && ++reads === 1) await appendFile(appender, pod, catalogUri, 'appended');
    };
    await remover.removeFromCatalog(catalogUri, instance('removed'), pod.fetch);

    expect(rows(pod, catalogUri)).toEqual([instance('appended'), instance('kept')].sort());
  });

  it('keeps both rows when both writers create a missing catalog at once', async () => {
    const catalogUri = `${STORAGE}catalog.ttl`;
    const pod = new FakePod(kind);
    const [first, second] = [await loadClient(), await loadClient()];

    interleaveAfterFirstRead(pod, catalogUri, () => appendFile(second, pod, catalogUri, 'from-second'));
    await appendFile(first, pod, catalogUri, 'from-first');

    expect(rows(pod, catalogUri)).toEqual([instance('from-first'), instance('from-second')].sort());
  });

  it('keeps every tombstone when two writers create the deletion log at once', async () => {
    const catalogUri = `${STORAGE}catalog.ttl`;
    const pod = new FakePod(kind);
    const [firstTag, secondTag] = [crypto.randomUUID(), crypto.randomUUID()];

    let interleaved = false;
    pod.beforeResponding = async (method, url) => {
      if (interleaved || url === catalogUri || (method !== 'PATCH' && method !== 'GET')) return;
      interleaved = true;
      await appendTombstones(catalogUri, [secondTag], pod.fetch);
    };
    await appendTombstones(catalogUri, [firstTag], pod.fetch);

    expect([...(await readTombstonedTags(catalogUri, pod.fetch)).keys()].sort()).toEqual([firstTag, secondTag].sort());
  });
});

describe('catalog writes against a catalog that keeps changing', () => {
  it('gives up after a bounded number of attempts instead of overwriting', async () => {
    const catalogUri = `${STORAGE}catalog.ttl`;
    const pod = new FakePod('put-only');
    const [writer, busy] = [await loadClient(), await loadClient()];
    await appendFile(busy, pod, catalogUri, 'existing');

    let otherWrites = 0;
    let busyWriting = false;
    pod.beforeResponding = async (method, url) => {
      // After each read by `writer`, `busy` completes a write of its own.
      if (busyWriting || method !== 'GET' || url !== catalogUri || otherWrites >= 50) return;
      busyWriting = true;
      otherWrites++;
      await appendFile(busy, pod, catalogUri, `busy-${otherWrites}`);
      busyWriting = false;
    };

    await expect(appendFile(writer, pod, catalogUri, 'blocked')).rejects.toThrow(/kept changing/);
    pod.beforeResponding = async () => {};
    expect(rows(pod, catalogUri)).toHaveLength(otherWrites + 1);
    expect(rows(pod, catalogUri)).not.toContain(instance('blocked'));
  });
});

import { describe, it, expect, vi } from 'vitest';
import { softDeleteFile, FILE_CHANGED_DURING_DELETE } from '../softDeleteFile-file/softDeleteFile';
import { appendToCatalog, parseCatalog } from '@/infrastructure/solid/catalog';
import type { FetchFn } from '@/types/solid';
import type { SharedEntry } from '@/types/sharing';

vi.mock('@/infrastructure/wac/wacAllow', () => ({ checkHasPermission: vi.fn().mockResolvedValue(true) }));
vi.mock('@/infrastructure/wac/aclSnapshot', () => ({ snapshotAcl: vi.fn().mockResolvedValue(false) }));
vi.mock('@/shared/hooks/useCatalogVersion', () => ({ notifyCatalogChanged: vi.fn() }));

/**
 * A small in-memory Solid server that implements entity tags and the
 * conditional requests softDeleteFile relies on, per RFC 9110:
 * `If-Match` uses strong comparison (a weak tag never matches),
 * `If-None-Match: *` fails on an existing resource, and
 * `If-Unmodified-Since` compares at one-second resolution.
 */
class FakePod {
  private readonly resources = new Map<string, { body: string; contentType: string; version: number; modified: number }>();
  private readonly containers = new Set<string>();
  private clock = Date.UTC(2026, 0, 1);
  readonly requests: { method: string; url: string; headers: Record<string, string>; cache?: RequestCache }[] = [];
  afterRequest: (method: string, url: string) => void = () => {};
  /** Answers (or fails) a request before the pod handles it, when it returns something. */
  intercept: (method: string, url: string) => Response | Error | undefined = () => undefined;
  /** Simulates content coding: `Content-Length` is the length on the wire, not the decoded size. */
  wireLength: (body: string) => number = (body) => new Blob([body]).size;

  private readonly tagKind: 'strong' | 'weak';

  constructor(tagKind: 'strong' | 'weak') {
    this.tagKind = tagKind;
  }

  etagOf(url: string): string {
    const version = this.resources.get(url)?.version ?? 0;
    return this.tagKind === 'strong' ? `"v${version}"` : `W/"v${version}"`;
  }

  body(url: string): string | undefined {
    return this.resources.get(url)?.body;
  }

  has(url: string): boolean {
    return this.resources.has(url) || this.containers.has(url);
  }

  /** Another client deletes a resource. */
  remove(url: string): void {
    this.resources.delete(url);
  }

  write(url: string, body: string, contentType = 'text/plain'): void {
    const version = (this.resources.get(url)?.version ?? 0) + 1;
    this.clock += 2000;
    this.resources.set(url, { body, contentType, version, modified: this.clock });
    let parent = url.slice(0, url.lastIndexOf('/', url.length - 2) + 1);
    while (parent.length > 'https://pod.example/'.length) {
      this.containers.add(parent);
      parent = parent.slice(0, parent.lastIndexOf('/', parent.length - 2) + 1);
    }
  }

  private children(containerUri: string): string[] {
    const all = [...this.resources.keys(), ...this.containers];
    return all.filter((uri) => {
      if (uri === containerUri || !uri.startsWith(containerUri)) return false;
      const rest = uri.slice(containerUri.length);
      return !rest.replace(/\/$/, '').includes('/');
    });
  }

  private preconditionFails(url: string, headers: Record<string, string>): boolean {
    const resource = this.resources.get(url);
    const ifMatch = headers['If-Match'];
    if (ifMatch !== undefined) {
      if (!resource) return true;
      const current = this.etagOf(url);
      const strongMatch = ifMatch === '*' || (!ifMatch.startsWith('W/') && !current.startsWith('W/') && ifMatch === current);
      if (!strongMatch) return true;
    }
    if (headers['If-None-Match'] === '*' && resource) return true;
    const ifUnmodifiedSince = headers['If-Unmodified-Since'];
    if (ifMatch === undefined && ifUnmodifiedSince !== undefined && resource) {
      if (Math.floor(resource.modified / 1000) > Math.floor(Date.parse(ifUnmodifiedSince) / 1000)) return true;
    }
    return false;
  }

  readonly fetch: FetchFn = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const headers = { ...((init?.headers as Record<string, string> | undefined) ?? {}) };
    this.requests.push({ method, url, headers, cache: init?.cache });
    try {
      const injected = this.intercept(method, url);
      if (injected instanceof Error) throw injected;
      if (injected) return injected;
      return await this.handle(url, method, headers, init);
    } finally {
      this.afterRequest(method, url);
    }
  };

  private async handle(url: string, method: string, headers: Record<string, string>, init?: RequestInit): Promise<Response> {
    const resource = this.resources.get(url);
    if (method === 'GET' || method === 'HEAD') {
      if (url.endsWith('/') && this.containers.has(url)) {
        const listing = this.children(url).map((child) => `<${url}> <http://www.w3.org/ns/ldp#contains> <${child}> .`).join('\n');
        return new Response(method === 'HEAD' ? null : listing, { status: 200, headers: { 'Content-Type': 'text/turtle' } });
      }
      if (!resource) return new Response(null, { status: 404, statusText: 'Not Found' });
      return new Response(method === 'HEAD' ? null : resource.body, {
        status: 200,
        headers: {
          'Content-Type': resource.contentType,
          'Content-Length': String(this.wireLength(resource.body)),
          ETag: this.etagOf(url),
          'Last-Modified': new Date(resource.modified).toUTCString(),
        },
      });
    }
    if (this.preconditionFails(url, headers)) return new Response(null, { status: 412, statusText: 'Precondition Failed' });
    if (method === 'PUT') {
      if (url.endsWith('/')) {
        if (this.containers.has(url)) return new Response(null, { status: 409, statusText: 'Conflict' });
        this.containers.add(url);
        return new Response(null, { status: 201, statusText: 'Created' });
      }
      const raw = init?.body;
      const body = raw && typeof raw === 'object' && 'text' in raw ? await (raw as Blob).text() : String(raw ?? '');
      this.write(url, body, headers['Content-Type'] ?? 'application/octet-stream');
      return new Response(null, { status: resource ? 205 : 201 });
    }
    if (method === 'PATCH') {
      if (!resource) return new Response(null, { status: 404, statusText: 'Not Found' });
      const inserts = /solid:inserts \{([\s\S]*?)\n {2}\}/.exec(String(init?.body ?? ''))?.[1] ?? '';
      this.write(url, `${resource.body}\n${inserts}`, resource.contentType);
      return new Response(null, { status: 205 });
    }
    if (method === 'DELETE') {
      if (url.endsWith('/')) {
        if (!this.containers.has(url)) return new Response(null, { status: 404, statusText: 'Not Found' });
        if (this.children(url).length > 0) return new Response(null, { status: 409, statusText: 'Conflict' });
        this.containers.delete(url);
        return new Response(null, { status: 205 });
      }
      if (!resource) return new Response(null, { status: 404, statusText: 'Not Found' });
      this.resources.delete(url);
      return new Response(null, { status: 205 });
    }
    return new Response(null, { status: 405, statusText: 'Method Not Allowed' });
  }
}

const containerUri = 'https://pod.example/app/report/';
const binaryUri = `${containerUri}report.txt`;
const metadataUri = `${containerUri}index.ttl`;
const catalogUri = 'https://pod.example/catalog.ttl';
const trashCatalogUri = 'https://pod.example/trash/catalog.ttl';
const trashItemContainerUri = 'https://pod.example/trash/item-1/';
const ownerWebId = 'https://pod.example/profile/card#me';

const entry: SharedEntry = {
  metadataUri,
  binaryUri,
  classUri: 'http://schema.org/TextDigitalDocument',
  mediaType: 'text/plain',
  byteSize: 9,
  title: 'report.txt',
  description: '',
  modified: '2026-01-01T00:00:00.000Z',
};

async function seededPod(tagKind: 'strong' | 'weak'): Promise<FakePod> {
  const pod = new FakePod(tagKind);
  pod.write(binaryUri, 'version 1');
  pod.write(metadataUri, '<> a <http://www.w3.org/ns/dcat#Dataset> .', 'text/turtle');
  await appendToCatalog({
    catalogUri, instanceUri: metadataUri, binaryUri, classUri: entry.classUri, parentUri: 'https://pod.example/app/',
    mediaType: 'text/plain', byteSize: 9, title: 'report.txt', description: '', modified: entry.modified,
    publisherWebId: ownerWebId, fetch: pod.fetch,
  });
  return pod;
}

/** Another client saves a newer version of the file once the trash copy is complete, before the delete. */
function editBetweenCopyAndDelete(pod: FakePod): void {
  let fired = false;
  pod.afterRequest = (method, url) => {
    if (!fired && method === 'PUT' && url === `${trashItemContainerUri}tombstone.ttl`) {
      fired = true;
      pod.write(binaryUri, 'version 2, saved by another client');
    }
  };
}

function runSoftDelete(pod: FakePod) {
  return softDeleteFile({
    containerUri, storageRootUri: 'https://pod.example/', catalogUri, entry, ownerWebId,
    fetch: pod.fetch, uniqueSuffix: 'item-1', now: new Date('2026-01-15T00:00:00.000Z'),
  });
}

const trashRows = (pod: FakePod) => parseCatalog(pod.body(trashCatalogUri) ?? '', trashCatalogUri);
const activeRows = (pod: FakePod) => parseCatalog(pod.body(catalogUri) ?? '', catalogUri);

describe.each(['strong', 'weak'] as const)('softDeleteFile against a server with %s entity tags', (tagKind) => {
  it('keeps the newer version when another client writes the file between the copy and the delete', async () => {
    const pod = await seededPod(tagKind);
    editBetweenCopyAndDelete(pod);

    const result = await runSoftDelete(pod);

    expect(result).toEqual({ ok: false, reason: FILE_CHANGED_DURING_DELETE });
    expect(pod.body(binaryUri)).toBe('version 2, saved by another client');
    expect(pod.has(metadataUri)).toBe(true);
    expect(activeRows(pod).map((row) => row.uri)).toContain(metadataUri);
  });

  it('removes the trash copy and its trash catalog row when the file changed during the deletion', async () => {
    const pod = await seededPod(tagKind);
    editBetweenCopyAndDelete(pod);

    await runSoftDelete(pod);

    expect(pod.has(trashItemContainerUri)).toBe(false);
    expect(pod.has(`${trashItemContainerUri}payload`)).toBe(false);
    expect(trashRows(pod)).toEqual([]);
  });

  it('moves the file to the trash when nobody writes it in between', async () => {
    const pod = await seededPod(tagKind);

    const result = await runSoftDelete(pod);

    expect(result).toEqual({ ok: true, trashItemContainerUri });
    expect(pod.has(binaryUri)).toBe(false);
    expect(pod.has(containerUri)).toBe(false);
    expect(pod.body(`${trashItemContainerUri}payload`)).toBe('version 1');
    expect(trashRows(pod).map((row) => row.uri)).toEqual([`${trashItemContainerUri}index.ttl`]);
  });

  it('keeps the trash copy when another client deletes the original between the copy and the delete', async () => {
    const pod = await seededPod(tagKind);
    let fired = false;
    pod.afterRequest = (method, url) => {
      if (!fired && method === 'PUT' && url === `${trashItemContainerUri}tombstone.ttl`) {
        fired = true;
        pod.remove(binaryUri);
      }
    };

    const result = await runSoftDelete(pod);

    expect(result).toEqual({ ok: true, trashItemContainerUri });
    expect(pod.body(`${trashItemContainerUri}payload`)).toBe('version 1');
    expect(trashRows(pod).map((row) => row.uri)).toEqual([`${trashItemContainerUri}index.ttl`]);
  });

  it('stops, and keeps the new file, when another client re-creates it right after the delete', async () => {
    const pod = await seededPod(tagKind);
    let fired = false;
    pod.afterRequest = (method, url) => {
      if (!fired && method === 'DELETE' && url === binaryUri) {
        fired = true;
        pod.write(binaryUri, 'version 2, saved by another client');
      }
    };

    const result = await runSoftDelete(pod);

    expect(result).toEqual({ ok: false, reason: FILE_CHANGED_DURING_DELETE });
    expect(pod.body(binaryUri)).toBe('version 2, saved by another client');
    expect(pod.has(metadataUri)).toBe(true);
    expect(activeRows(pod).map((row) => row.uri)).toContain(metadataUri);
    expect(pod.body(`${trashItemContainerUri}payload`)).toBe('version 1');
  });
});

describe('softDeleteFile: the conditional delete', () => {
  it('sends DELETE on the original with If-Match set to the tag of the copied version', async () => {
    const pod = await seededPod('strong');
    const copiedTag = pod.etagOf(binaryUri);

    await runSoftDelete(pod);

    const binaryDeletes = pod.requests.filter((request) => request.method === 'DELETE' && request.url === binaryUri);
    expect(binaryDeletes[0]?.headers['If-Match']).toBe(copiedTag);
  });

  it('does not put a weak tag in If-Match, which can never match, and re-checks the file instead', async () => {
    const pod = await seededPod('weak');

    await runSoftDelete(pod);

    const binaryDelete = pod.requests.find((request) => request.method === 'DELETE' && request.url === binaryUri);
    expect(binaryDelete?.headers['If-Match']).toBeUndefined();
    expect(binaryDelete?.headers['If-Unmodified-Since']).toBeDefined();
    const binaryRequests = pod.requests.filter((request) => request.url === binaryUri).map((request) => request.method);
    expect(binaryRequests.slice(-2)).toEqual(['HEAD', 'DELETE']);
  });

  it('reads the version it copies uncached, so the tag is the server\'s current one', async () => {
    const pod = await seededPod('strong');

    await runSoftDelete(pod);

    const binaryGet = pod.requests.find((request) => request.method === 'GET' && request.url === binaryUri);
    expect(binaryGet?.cache).toBe('no-store');
  });

  it('does not mistake a content-coded length for a change on the weak-tag path', async () => {
    const pod = await seededPod('weak');
    pod.wireLength = (body) => Math.ceil(body.length / 2);

    const result = await runSoftDelete(pod);

    expect(result).toEqual({ ok: true, trashItemContainerUri });
    expect(pod.has(binaryUri)).toBe(false);
  });

  it('removes the trash copy when the server refuses the delete, since the original is still there', async () => {
    const pod = await seededPod('strong');
    pod.intercept = (method, url) =>
      method === 'DELETE' && url === binaryUri ? new Response(null, { status: 403, statusText: 'Forbidden' }) : undefined;

    const result = await runSoftDelete(pod);

    expect(result).toEqual({ ok: false, reason: `${binaryUri}: 403 Forbidden` });
    expect(pod.body(binaryUri)).toBe('version 1');
    expect(pod.has(trashItemContainerUri)).toBe(false);
    expect(trashRows(pod)).toEqual([]);
  });

  it('returns a failure instead of throwing when the delete hits a network error, and keeps the trash copy', async () => {
    const pod = await seededPod('strong');
    pod.intercept = (method, url) => (method === 'DELETE' && url === binaryUri ? new TypeError('Failed to fetch') : undefined);

    const result = await runSoftDelete(pod);

    expect(result).toEqual({ ok: false, reason: 'Failed to fetch' });
    expect(pod.body(`${trashItemContainerUri}payload`)).toBe('version 1');
  });
});

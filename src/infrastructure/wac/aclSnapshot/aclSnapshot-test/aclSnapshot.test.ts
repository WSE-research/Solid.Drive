import { describe, it, expect, vi } from 'vitest';
import { snapshotAcl, restoreAclFromSnapshot } from '../aclSnapshot-file/aclSnapshot';
import { buildAclTurtle } from '@/infrastructure/wac/aclManager';
import type { FetchFn } from '@/types/solid';

const resourceUri = 'https://pod.example/app/file/';
const aclUri = 'https://pod.example/app/file/.acl';
const snapshotUri = 'https://pod.example/app/trash/file-abc/acl-snapshot.ttl';

const makeFetch = (responses: Record<string, { status: number; headers?: Record<string, string>; body?: string }>) =>
  vi.fn<FetchFn>(async (input, init) => {
    const url = String(input);
    const key = `${init?.method ?? 'GET'} ${url}`;
    const mocked = responses[key] ?? responses[url] ?? { status: 404 };
    return new Response(mocked.body ?? '', {
      status: mocked.status,
      headers: mocked.headers,
    });
  });

describe('snapshotAcl', () => {
  // acl:Control and acl:agentClass foaf:Agent grants that readAclAgents/buildAclTurtle
  // would silently drop, to lock in that the raw-bytes snapshot preserves everything.
  const richAcl = [
    '@prefix acl: <http://www.w3.org/ns/auth/acl#> .',
    `<#owner> a acl:Authorization ; acl:agent <https://owner.example/#me> ; acl:accessTo <${resourceUri}> ; acl:mode acl:Read, acl:Write, acl:Control .`,
    `<#public> a acl:Authorization ; acl:agentClass <http://xmlns.com/foaf/0.1/Agent> ; acl:accessTo <${resourceUri}> ; acl:mode acl:Read .`,
  ].join('\n');

  it('copies the ACL document byte-for-byte to the snapshot URI, preserving Control and public grants', async () => {
    const fetchFn = makeFetch({
      [`HEAD ${resourceUri}`]: { status: 200, headers: { Link: `<${aclUri}>; rel="acl"` } },
      [aclUri]: { status: 200, body: richAcl },
      [`PUT ${snapshotUri}`]: { status: 201 },
    });

    const result = await snapshotAcl(resourceUri, snapshotUri, fetchFn);

    expect(result).toBe(true);
    const putCall = fetchFn.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT');
    expect((putCall![1] as RequestInit).body).toBe(richAcl);
    expect((putCall![1] as RequestInit).headers).toEqual({ 'Content-Type': 'text/turtle' });
  });

  it('returns false and does not PUT when the Link header points at an ACL that 404s', async () => {
    const fetchFn = makeFetch({
      [`HEAD ${resourceUri}`]: { status: 200, headers: { Link: `<${aclUri}>; rel="acl"` } },
      [aclUri]: { status: 404 },
    });

    const result = await snapshotAcl(resourceUri, snapshotUri, fetchFn);

    expect(result).toBe(false);
    expect(fetchFn.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')).toBe(false);
  });

  it('throws when the resource has no Link header at all', async () => {
    const fetchFn = makeFetch({ [`HEAD ${resourceUri}`]: { status: 200 } });
    await expect(snapshotAcl(resourceUri, snapshotUri, fetchFn)).rejects.toThrow('No ACL link header');
  });
});

describe('restoreAclFromSnapshot', () => {
  const savedAcl = buildAclTurtle(resourceUri, 'https://owner.example/#me', ['https://alice.example/#me']);

  it('PUTs the snapshot content back to the resource ACL URI', async () => {
    const fetchFn = makeFetch({
      [snapshotUri]: { status: 200, body: savedAcl },
      [`HEAD ${resourceUri}`]: { status: 200, headers: { Link: `<${aclUri}>; rel="acl"` } },
      [`PUT ${aclUri}`]: { status: 201 },
    });

    const result = await restoreAclFromSnapshot(snapshotUri, resourceUri, fetchFn);

    expect(result).toBe(true);
    const putCall = fetchFn.mock.calls.find(([url, init]) => url === aclUri && (init as RequestInit | undefined)?.method === 'PUT');
    expect((putCall![1] as RequestInit).body).toBe(savedAcl);
  });

  it('returns false and does not touch the resource ACL when no snapshot exists', async () => {
    const fetchFn = makeFetch({ [snapshotUri]: { status: 404 } });

    const result = await restoreAclFromSnapshot(snapshotUri, resourceUri, fetchFn);

    expect(result).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('throws when the snapshot GET fails with a non-404 error', async () => {
    const fetchFn = makeFetch({ [snapshotUri]: { status: 500 } });
    await expect(restoreAclFromSnapshot(snapshotUri, resourceUri, fetchFn)).rejects.toThrow('500');
  });
});

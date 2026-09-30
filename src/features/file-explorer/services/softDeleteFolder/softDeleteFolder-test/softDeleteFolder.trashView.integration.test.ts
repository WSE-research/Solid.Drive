/**
 * Runs softDeleteFolder and useTrashEntries together against a fake
 * in-memory pod instead of mocking the catalog layer between them.
 *
 * Stubbed out: permission checks, ACL snapshotting, the actual container
 * copy, and the hard delete. None of that decides whether the trashed
 * folder shows up correctly in the bin, so it's not worth the setup.
 * Everything that does decide that is real: appendFolderToCatalog,
 * parseCatalog, the write queue, useCatalog's cache, and useTrashEntries's
 * own kind/tombstone handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { FetchFn } from '@/types/solid';

const webId = 'https://pod.example/profile/card#me';
let fakeFetch: FetchFn;

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ session: { webId }, fetch: fakeFetch }),
  useResource: () => undefined,
}));

vi.mock('@/infrastructure/wac/wacAllow', () => ({
  checkHasPermission: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/infrastructure/wac/aclSnapshot', () => ({
  snapshotAcl: vi.fn().mockResolvedValue(false),
  restoreAclFromSnapshot: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/infrastructure/solid/resourceCopy', () => ({
  copyContainerTree: vi.fn().mockResolvedValue(undefined),
  ensureContainer: vi.fn().mockResolvedValue(undefined),
  copyResource: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/features/file-explorer/services/deleteResource', () => ({
  deleteResource: vi.fn().mockResolvedValue({ ok: true }),
  deleteResourceQuietly: vi.fn().mockResolvedValue(undefined),
}));

import { softDeleteFolder } from '../softDeleteFolder-file/softDeleteFolder';
import { useTrashEntries } from '@/features/file-explorer/hooks/useTrashEntries';
import { appendFolderToCatalog } from '@/infrastructure/solid/catalog';
import { __resetCatalogCacheForTests } from '@/features/file-explorer/hooks/useCatalog';
import { __resetCatalogVersionsForTests } from '@/shared/hooks/useCatalogVersion';

/** An in-memory pod: GET/PUT/HEAD/DELETE against a Map, keyed by URI. */
function makeFakePod() {
  const documents = new Map<string, string>();

  const fetch = vi.fn(async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (method === 'PUT') {
      documents.set(url, (init?.body as string) ?? '');
      return { ok: true, status: 200, statusText: 'OK' } as Response;
    }
    if (method === 'HEAD') {
      return documents.has(url)
        ? ({ ok: true, status: 200, statusText: 'OK' } as Response)
        : ({ ok: false, status: 404, statusText: 'Not Found' } as Response);
    }
    if (method === 'DELETE') {
      documents.delete(url);
      return { ok: true, status: 200, statusText: 'OK' } as Response;
    }
    const content = documents.get(url);
    return content !== undefined
      ? ({ ok: true, status: 200, statusText: 'OK', text: async () => content } as Response)
      : ({ ok: false, status: 404, statusText: 'Not Found', text: async () => '' } as Response);
  });

  return { fetch, documents };
}

describe('softDeleteFolder → useTrashEntries (integration)', () => {
  const storageRootUri = 'https://pod.example/';
  const catalogUri = 'https://pod.example/catalog.ttl';
  const folderUri = 'https://pod.example/new-folder-test/folder1/';

  beforeEach(() => {
    __resetCatalogCacheForTests();
    __resetCatalogVersionsForTests();
  });

  it('shows a soft-deleted folder in the Recycle bin right after it is deleted', async () => {
    const pod = makeFakePod();
    fakeFetch = pod.fetch;

    // Give the folder a real catalog entry first, same as if it had been
    // created through the app before this test deletes it.
    await appendFolderToCatalog({
      catalogUri,
      folderUri,
      parentUri: 'https://pod.example/new-folder-test/',
      title: 'folder1',
      modified: '2026-01-01T00:00:00.000Z',
      publisherWebId: webId,
      fetch: fakeFetch,
    });

    const result = await softDeleteFolder({
      containerUri: folderUri,
      storageRootUri,
      catalogUri,
      ownerWebId: webId,
      fetch: fakeFetch,
      uniqueSuffix: 'trash-item-1',
    });
    expect(result.ok).toBe(true);

    const { result: hookResult } = renderHook(() => useTrashEntries(storageRootUri));
    await waitFor(() => expect(hookResult.current.entries).toHaveLength(1));

    const [entry] = hookResult.current.entries;
    expect(entry.kind).toBe('folder');
    expect(entry.entry.title).toBe('folder1');
    expect(entry.tombstone?.originalContainerUri).toBe(folderUri);
  });
});

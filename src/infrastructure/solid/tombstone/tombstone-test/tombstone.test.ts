import { describe, it, expect, vi } from 'vitest';
import { Parser as N3Parser, Store as N3Store } from 'n3';
import {
  buildTombstoneTurtle,
  parseTombstone,
  writeTombstone,
  readTombstone,
  computeExpiry,
  isExpired,
  type Tombstone,
} from '../tombstone-file/tombstone';
import type { FetchFn } from '@/types/solid';
import { TRASH_TERMS } from '@/config';

const DCTERMS = 'http://purl.org/dc/terms/';
const PROV_INVALIDATED_AT = 'http://www.w3.org/ns/prov#invalidatedAtTime';

// Every predicate a field can be read from; removing all of them must make
// the tombstone unreadable. Left out on purpose: originalParentUri may be
// empty for an item at the storage root, kind defaults to "file" on a
// tombstone older than folder soft-delete, and hasAclSnapshot is derived
// from whether the tombstone links an access-control snapshot.
const PREDICATES_BY_FIELD: Record<Exclude<keyof Tombstone, 'originalParentUri' | 'kind' | 'hasAclSnapshot'>, string[]> = {
  originalContainerUri: [`${DCTERMS}source`],
  originalCatalogUri: [TRASH_TERMS.originalCatalog],
  originalInstanceUri: [TRASH_TERMS.originalInstance],
  originalBinaryName: [`${DCTERMS}title`],
  originalClassUri: [TRASH_TERMS.formerType],
  deletedAt: [TRASH_TERMS.deletedAt, PROV_INVALIDATED_AT],
  expiresAt: [`${DCTERMS}valid`],
};

const tombstoneUri = 'https://pod.example/trash/photo-abc123/tombstone.ttl';

const sampleTombstone: Tombstone = {
  kind: 'file',
  originalContainerUri: 'https://pod.example/my-solid-app/photo-2024/',
  originalParentUri: 'https://pod.example/my-solid-app/',
  originalCatalogUri: 'https://pod.example/catalog.ttl',
  originalInstanceUri: 'https://pod.example/my-solid-app/photo-2024/index.ttl',
  originalBinaryName: 'photo.jpg',
  originalClassUri: 'http://schema.org/ImageObject',
  hasAclSnapshot: true,
  deletedAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-01-31T00:00:00.000Z',
};

const sampleFolderTombstone: Tombstone = {
  ...sampleTombstone,
  kind: 'folder',
  originalContainerUri: 'https://pod.example/my-solid-app/photos/',
  originalInstanceUri: 'https://pod.example/my-solid-app/photos/',
  originalBinaryName: '',
  originalClassUri: 'https://w3id.org/solid-drive-catalog#Folder',
};

describe('buildTombstoneTurtle / parseTombstone', () => {
  it('round-trips a tombstone through Turtle', () => {
    const turtle = buildTombstoneTurtle(tombstoneUri, sampleTombstone);
    expect(parseTombstone(turtle, tombstoneUri)).toEqual(sampleTombstone);
  });

  it('round-trips hasAclSnapshot: false', () => {
    const tombstone = { ...sampleTombstone, hasAclSnapshot: false };
    const turtle = buildTombstoneTurtle(tombstoneUri, tombstone);
    expect(parseTombstone(turtle, tombstoneUri)).toEqual(tombstone);
  });

  it('round-trips an empty originalParentUri for a file that lived at the storage root', () => {
    const tombstone = { ...sampleTombstone, originalParentUri: '' };
    const turtle = buildTombstoneTurtle(tombstoneUri, tombstone);
    expect(parseTombstone(turtle, tombstoneUri)).toEqual(tombstone);
  });

  it('returns null for empty text', () => {
    expect(parseTombstone('', tombstoneUri)).toBeNull();
  });

  it('returns null for malformed turtle', () => {
    expect(parseTombstone('this is not turtle {{{', tombstoneUri)).toBeNull();
  });

  it.each(Object.keys(PREDICATES_BY_FIELD) as (keyof typeof PREDICATES_BY_FIELD)[])(
    'returns null when %s is missing',
    (missingField) => {
      const turtle = buildTombstoneTurtle(tombstoneUri, sampleTombstone);
      const predicates = PREDICATES_BY_FIELD[missingField];
      const withoutField = turtle
        .split('\n')
        .filter((line) => !predicates.some((predicate) => line.includes(predicate)))
        .join('\n');
      expect(parseTombstone(withoutField, tombstoneUri)).toBeNull();
    },
  );

  it('round-trips a folder tombstone, with an empty originalBinaryName', () => {
    const turtle = buildTombstoneTurtle(tombstoneUri, sampleFolderTombstone);
    expect(parseTombstone(turtle, tombstoneUri)).toEqual(sampleFolderTombstone);
  });

  it('defaults kind to "file" when the predicate predates folder soft-delete', () => {
    const turtle = buildTombstoneTurtle(tombstoneUri, sampleTombstone)
      .split('\n')
      .filter((line) => !line.includes(TRASH_TERMS.kind))
      .join('\n');
    expect(parseTombstone(turtle, tombstoneUri)).toEqual(sampleTombstone);
  });

  it('does not require originalBinaryName for a folder tombstone', () => {
    const turtle = buildTombstoneTurtle(tombstoneUri, sampleFolderTombstone);
    expect(parseTombstone(turtle, tombstoneUri)).not.toBeNull();
  });
});

describe('buildTombstoneTurtle standard terms for other applications', () => {
  const trashItemUri = 'https://pod.example/trash/photo-abc123/';

  function objectsOf(turtle: string, predicate: string): string[] {
    const store = new N3Store(new N3Parser({ baseIRI: tombstoneUri }).parse(turtle));
    return store.getObjects(tombstoneUri, predicate, null).map((term) => term.value);
  }

  it('types the tombstone as a PROV entity as well as an Activity Streams tombstone', () => {
    const turtle = buildTombstoneTurtle(tombstoneUri, sampleTombstone);
    expect(objectsOf(turtle, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type').sort()).toEqual(
      ['http://www.w3.org/ns/prov#Entity', 'https://www.w3.org/ns/activitystreams#Tombstone'].sort(),
    );
  });

  it('records the deletion time as prov:invalidatedAtTime', () => {
    const turtle = buildTombstoneTurtle(tombstoneUri, sampleTombstone);
    expect(objectsOf(turtle, 'http://www.w3.org/ns/prov#invalidatedAtTime')).toEqual([sampleTombstone.deletedAt]);
  });

  it('records the original location as dcterms:source', () => {
    const turtle = buildTombstoneTurtle(tombstoneUri, sampleTombstone);
    expect(objectsOf(turtle, `${DCTERMS}source`)).toEqual([sampleTombstone.originalContainerUri]);
  });

  it('records the retention deadline as dcterms:valid', () => {
    const turtle = buildTombstoneTurtle(tombstoneUri, sampleTombstone);
    expect(objectsOf(turtle, `${DCTERMS}valid`)).toEqual([sampleTombstone.expiresAt]);
  });

  it('records a file name as dcterms:title', () => {
    const turtle = buildTombstoneTurtle(tombstoneUri, sampleTombstone);
    expect(objectsOf(turtle, `${DCTERMS}title`)).toEqual(['photo.jpg']);
  });

  it('records a folder name as dcterms:title', () => {
    const turtle = buildTombstoneTurtle(tombstoneUri, sampleFolderTombstone);
    expect(objectsOf(turtle, `${DCTERMS}title`)).toEqual(['photos']);
  });

  it('links a file tombstone to its preserved payload, metadata, and access-control snapshot', () => {
    const turtle = buildTombstoneTurtle(tombstoneUri, sampleTombstone);
    expect(objectsOf(turtle, `${DCTERMS}hasPart`).sort()).toEqual(
      [`${trashItemUri}payload`, `${trashItemUri}index.ttl`, `${trashItemUri}acl-snapshot.ttl`].sort(),
    );
  });

  it('links a folder tombstone to its payload container and catalog snapshot', () => {
    const turtle = buildTombstoneTurtle(tombstoneUri, sampleFolderTombstone);
    expect(objectsOf(turtle, `${DCTERMS}hasPart`).sort()).toEqual(
      [`${trashItemUri}payload/`, `${trashItemUri}catalog-snapshot.ttl`, `${trashItemUri}acl-snapshot.ttl`].sort(),
    );
  });

  it('does not link an access-control snapshot that was never captured', () => {
    const turtle = buildTombstoneTurtle(tombstoneUri, { ...sampleTombstone, hasAclSnapshot: false });
    expect(objectsOf(turtle, `${DCTERMS}hasPart`)).not.toContain(`${trashItemUri}acl-snapshot.ttl`);
  });
});

describe('computeExpiry', () => {
  it('adds retentionDays to deletedAt', () => {
    expect(computeExpiry(new Date('2026-01-01T00:00:00.000Z'), 30)).toBe('2026-01-31T00:00:00.000Z');
  });

  it('crosses a month boundary correctly', () => {
    expect(computeExpiry(new Date('2026-01-20T00:00:00.000Z'), 30)).toBe('2026-02-19T00:00:00.000Z');
  });

  it('crosses a DST boundary correctly (UTC arithmetic, no local-time drift)', () => {
    expect(computeExpiry(new Date('2026-03-01T00:00:00.000Z'), 30)).toBe('2026-03-31T00:00:00.000Z');
  });
});

describe('isExpired', () => {
  it('is true when expiresAt is in the past', () => {
    expect(isExpired(sampleTombstone, new Date('2026-02-01T00:00:00.000Z'))).toBe(true);
  });

  it('is false when expiresAt is in the future', () => {
    expect(isExpired(sampleTombstone, new Date('2026-01-15T00:00:00.000Z'))).toBe(false);
  });

  it('is true exactly at expiresAt', () => {
    expect(isExpired(sampleTombstone, new Date(sampleTombstone.expiresAt))).toBe(true);
  });
});

describe('writeTombstone', () => {
  it('PUTs the serialized tombstone with the right content type', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => new Response('', { status: 201 }));
    await writeTombstone(tombstoneUri, sampleTombstone, fetchFn);

    expect(fetchFn).toHaveBeenCalledWith(
      tombstoneUri,
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'text/turtle' },
      }),
    );
    const body = String((fetchFn.mock.calls[0][1] as RequestInit).body);
    expect(parseTombstone(body, tombstoneUri)).toEqual(sampleTombstone);
  });

  it('throws when the PUT fails', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => new Response('', { status: 403, statusText: 'Forbidden' }));
    await expect(writeTombstone(tombstoneUri, sampleTombstone, fetchFn)).rejects.toThrow('403');
  });
});

describe('readTombstone', () => {
  it('returns null on 404', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => new Response('', { status: 404 }));
    expect(await readTombstone(tombstoneUri, fetchFn)).toBeNull();
  });

  it('throws on a non-404 error', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => new Response('', { status: 500, statusText: 'Server Error' }));
    await expect(readTombstone(tombstoneUri, fetchFn)).rejects.toThrow('500');
  });

  it('parses a successful response', async () => {
    const turtle = buildTombstoneTurtle(tombstoneUri, sampleTombstone);
    const fetchFn = vi.fn<FetchFn>(async () => new Response(turtle, { status: 200 }));
    expect(await readTombstone(tombstoneUri, fetchFn)).toEqual(sampleTombstone);
  });
});

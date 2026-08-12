import { describe, it, expect, vi } from 'vitest';
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

const PREDICATE_BY_FIELD: Record<keyof Tombstone, string> = {
  originalContainerUri: TRASH_TERMS.originalContainer,
  originalCatalogUri: TRASH_TERMS.originalCatalog,
  originalInstanceUri: TRASH_TERMS.originalInstance,
  originalBinaryName: TRASH_TERMS.originalBinaryName,
  originalClassUri: TRASH_TERMS.formerType,
  hasAclSnapshot: TRASH_TERMS.hasAclSnapshot,
  deletedAt: TRASH_TERMS.deletedAt,
  expiresAt: TRASH_TERMS.expiresAt,
};

const tombstoneUri = 'https://pod.example/trash/photo-abc123/tombstone.ttl';

const sampleTombstone: Tombstone = {
  originalContainerUri: 'https://pod.example/my-solid-app/photo-2024/',
  originalCatalogUri: 'https://pod.example/catalog.ttl',
  originalInstanceUri: 'https://pod.example/my-solid-app/photo-2024/index.ttl',
  originalBinaryName: 'photo.jpg',
  originalClassUri: 'http://schema.org/ImageObject',
  hasAclSnapshot: true,
  deletedAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-01-31T00:00:00.000Z',
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

  it('returns null for empty text', () => {
    expect(parseTombstone('', tombstoneUri)).toBeNull();
  });

  it('returns null for malformed turtle', () => {
    expect(parseTombstone('this is not turtle {{{', tombstoneUri)).toBeNull();
  });

  it.each(Object.keys(sampleTombstone) as (keyof Tombstone)[])(
    'returns null when %s is missing',
    (missingField) => {
      const turtle = buildTombstoneTurtle(tombstoneUri, sampleTombstone);
      const predicate = PREDICATE_BY_FIELD[missingField];
      const withoutField = turtle
        .split('\n')
        .filter((line) => !line.includes(predicate))
        .join('\n');
      expect(parseTombstone(withoutField, tombstoneUri)).toBeNull();
    },
  );
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

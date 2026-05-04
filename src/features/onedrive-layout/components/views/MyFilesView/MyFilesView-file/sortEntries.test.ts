import { describe, it, expect } from 'vitest';
import type { CatalogEntry } from '@/types';
import type { SortState } from '@/features/onedrive-layout/hooks/useMyFilesSort';
import { sortEntries } from './sortEntries';
import type { SortableEntry } from './sortEntries';

const folder = (uri: string): SortableEntry => ({
  kind: 'folder',
  uri,
  displayName: decodeURIComponent(uri.replace(/\/$/, '').split('/').pop() ?? ''),
  catalogEntry: undefined,
});

const fileFromCatalog = (
  uri: string,
  entry: Partial<CatalogEntry>,
): SortableEntry => ({
  kind: 'file',
  uri,
  displayName: entry.title ?? '',
  catalogEntry: {
    uri,
    conformsTo: '',
    title: '',
    description: '',
    modified: '',
    publisher: '',
    mediaType: '',
    byteSize: 0,
    accessURL: '',
    ...entry,
  } as CatalogEntry,
});

const sortAsc: SortState = { key: 'name', direction: 'asc' };
const sortDesc: SortState = { key: 'name', direction: 'desc' };

describe('sortEntries', () => {
  it('sorts folders alphabetically asc by default', () => {
    const result = sortEntries(
      [folder('https://x/c/'), folder('https://x/a/'), folder('https://x/b/')],
      sortAsc,
    );
    expect(result.map((e) => e.displayName)).toEqual(['a', 'b', 'c']);
  });

  it('reverses order when direction is desc', () => {
    const result = sortEntries(
      [folder('https://x/a/'), folder('https://x/b/')],
      sortDesc,
    );
    expect(result.map((e) => e.displayName)).toEqual(['b', 'a']);
  });

  it('places folders before files regardless of sort key', () => {
    const result = sortEntries(
      [
        fileFromCatalog('https://x/file/', { title: 'aaa.pdf' }),
        folder('https://x/zfolder/'),
      ],
      sortAsc,
    );
    expect(result.map((e) => e.kind)).toEqual(['folder', 'file']);
  });

  it('sorts files by modified asc', () => {
    const result = sortEntries(
      [
        fileFromCatalog('https://x/c/', {
          title: 'c',
          modified: '2026-03-01T00:00:00Z',
        }),
        fileFromCatalog('https://x/a/', {
          title: 'a',
          modified: '2026-01-01T00:00:00Z',
        }),
        fileFromCatalog('https://x/b/', {
          title: 'b',
          modified: '2026-02-01T00:00:00Z',
        }),
      ],
      { key: 'modified', direction: 'asc' },
    );
    expect(result.map((e) => e.displayName)).toEqual(['a', 'b', 'c']);
  });

  it('sorts files by size desc', () => {
    const result = sortEntries(
      [
        fileFromCatalog('https://x/a/', { title: 'a', byteSize: 100 }),
        fileFromCatalog('https://x/b/', { title: 'b', byteSize: 9000 }),
        fileFromCatalog('https://x/c/', { title: 'c', byteSize: 500 }),
      ],
      { key: 'size', direction: 'desc' },
    );
    expect(result.map((e) => e.displayName)).toEqual(['b', 'c', 'a']);
  });

  it('places entries with missing modified at the end of their group', () => {
    const result = sortEntries(
      [
        fileFromCatalog('https://x/a/', {
          title: 'a',
          modified: '2026-01-01T00:00:00Z',
        }),
        fileFromCatalog('https://x/b/', { title: 'b' }), // no modified
        fileFromCatalog('https://x/c/', {
          title: 'c',
          modified: '2026-03-01T00:00:00Z',
        }),
      ],
      { key: 'modified', direction: 'asc' },
    );
    expect(result.map((e) => e.displayName)).toEqual(['a', 'c', 'b']);
  });

  it('sort by sharing currently does not reorder (sharing kind is private until row resolves)', () => {
    const result = sortEntries(
      [
        fileFromCatalog('https://x/c/', { title: 'c' }),
        fileFromCatalog('https://x/a/', { title: 'a' }),
      ],
      { key: 'sharing', direction: 'asc' },
    );
    // All sharing kinds are unknown at sort time → keep original order
    expect(result.map((e) => e.displayName)).toEqual(['c', 'a']);
  });
});

import { describe, it, expect } from 'vitest';
import { collectSubtreeCatalogEntries } from '../catalogSubtree-file/catalogSubtree';
import type { CatalogEntry } from '@/types';

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

describe('collectSubtreeCatalogEntries', () => {
  const root = 'https://pod.example/app/photos/';
  const sub = 'https://pod.example/app/photos/vacation/';
  const rootFile = 'https://pod.example/app/photos/beach.jpg/index.ttl';
  const subFile = 'https://pod.example/app/photos/vacation/sunset.jpg/index.ttl';
  const unrelated = 'https://pod.example/app/docs/report.pdf/index.ttl';

  it("includes the root's own entry followed by its direct children", () => {
    const entries = [
      makeEntry({ uri: root, title: 'Photos' }),
      makeEntry({ uri: rootFile, title: 'beach.jpg', parentUri: root }),
      makeEntry({ uri: unrelated, title: 'report.pdf', parentUri: 'https://pod.example/app/docs/' }),
    ];

    expect(collectSubtreeCatalogEntries(entries, root)).toEqual([entries[0], entries[1]]);
  });

  it('walks nested folders to any depth, breadth-first', () => {
    const entries = [
      makeEntry({ uri: root, title: 'Photos' }),
      makeEntry({ uri: sub, title: 'Vacation', parentUri: root }),
      makeEntry({ uri: rootFile, title: 'beach.jpg', parentUri: root }),
      makeEntry({ uri: subFile, title: 'sunset.jpg', parentUri: sub }),
    ];

    const collected = collectSubtreeCatalogEntries(entries, root);
    expect(collected.map((entry) => entry.uri)).toEqual([root, sub, rootFile, subFile]);
  });

  it('excludes entries outside the subtree', () => {
    const entries = [
      makeEntry({ uri: root, title: 'Photos' }),
      makeEntry({ uri: unrelated, title: 'report.pdf', parentUri: 'https://pod.example/app/docs/' }),
    ];

    expect(collectSubtreeCatalogEntries(entries, root)).toEqual([entries[0]]);
  });

  it('still collects descendants when the root itself has no catalog entry', () => {
    const entries = [
      makeEntry({ uri: rootFile, title: 'beach.jpg', parentUri: root }),
    ];

    expect(collectSubtreeCatalogEntries(entries, root)).toEqual([entries[0]]);
  });

  it('returns an empty list for a folder with no entry and no catalogued descendants', () => {
    expect(collectSubtreeCatalogEntries([], root)).toEqual([]);
  });

  it('terminates and visits each entry once when parentUri data has a cycle', () => {
    // Malformed data: sub claims root as its parent (correct) but root
    // also claims sub as ITS parent, closing a loop.
    const entries = [
      makeEntry({ uri: root, title: 'Photos', parentUri: sub }),
      makeEntry({ uri: sub, title: 'Vacation', parentUri: root }),
    ];

    const collected = collectSubtreeCatalogEntries(entries, root);
    expect(collected.map((entry) => entry.uri)).toEqual([root, sub]);
  });
});

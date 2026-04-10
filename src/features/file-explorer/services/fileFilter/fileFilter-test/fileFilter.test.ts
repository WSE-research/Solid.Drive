import { describe, it, expect, vi } from 'vitest';
import type { SolidLeaf } from '@ldo/connected-solid';
import { isVisibleLeaf } from '../fileFilter-file/fileFilter';

// Mock dependencies
vi.mock('@/infrastructure/solid/sharedCatalog', () => ({
  isSharedCatalogFile: (name: string) => name.startsWith('.shared-'),
}));

vi.mock('@/config/constants', () => ({
  SYSTEM_FILES: new Set(['catalog.ttl', 'robots.txt', 'README', '.acl', '.meta']),
}));

function makeLeaf(uri: string) {
  return { uri } as SolidLeaf;
}

describe('isVisibleLeaf', () => {
  it('returns true for a normal file', () => {
    expect(isVisibleLeaf(makeLeaf('https://pod.example/files/photo.jpg'))).toBe(true);
  });

  it('returns false for .acl system file', () => {
    expect(isVisibleLeaf(makeLeaf('https://pod.example/files/.acl'))).toBe(false);
  });

  it('returns false for .meta system file', () => {
    expect(isVisibleLeaf(makeLeaf('https://pod.example/files/.meta'))).toBe(false);
  });

  it('returns false for catalog.ttl system file', () => {
    expect(isVisibleLeaf(makeLeaf('https://pod.example/files/catalog.ttl'))).toBe(false);
  });

  it('returns false for robots.txt system file', () => {
    expect(isVisibleLeaf(makeLeaf('https://pod.example/files/robots.txt'))).toBe(false);
  });

  it('returns false for README system file', () => {
    expect(isVisibleLeaf(makeLeaf('https://pod.example/files/README'))).toBe(false);
  });

  it('returns false for shared catalog files', () => {
    expect(isVisibleLeaf(makeLeaf('https://pod.example/files/.shared-abc.ttl'))).toBe(false);
  });

  it('returns true for non-system, non-shared files', () => {
    expect(isVisibleLeaf(makeLeaf('https://pod.example/files/document.pdf'))).toBe(true);
  });

  it('decodes URI-encoded file names', () => {
    expect(isVisibleLeaf(makeLeaf('https://pod.example/files/.shared-test%40user.ttl'))).toBe(false);
  });

  it('returns true for regular files with dots', () => {
    expect(isVisibleLeaf(makeLeaf('https://pod.example/files/my.document.pdf'))).toBe(true);
  });

  it('returns true when URI ends with trailing slash because the extracted filename is empty', () => {
    // When URI ends with /, pop returns "", which is not a system file
    expect(isVisibleLeaf(makeLeaf('https://pod.example/files/'))).toBe(true);
  });

  it('returns true for an empty URI string since no system-file name matches', () => {
    expect(isVisibleLeaf(makeLeaf(''))).toBe(true);
  });

  it('falls back to empty string when split/pop yields undefined', () => {
    // Force the ?? "" fallback by providing a uri whose split().pop() returns undefined
    const leaf = { uri: '' } as SolidLeaf;
    const original = Array.prototype.pop;
    Array.prototype.pop = function () { return undefined; };
    try {
      expect(isVisibleLeaf(leaf)).toBe(true);
    } finally {
      Array.prototype.pop = original;
    }
  });
});

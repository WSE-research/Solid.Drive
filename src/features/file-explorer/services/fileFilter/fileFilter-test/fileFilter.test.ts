import { describe, it, expect, vi } from 'vitest';
import { isVisibleLeaf } from '../fileFilter-file/fileFilter';

// Mock dependencies
vi.mock('@/infrastructure/solid/sharedCatalog', () => ({
  isSharedCatalogFile: (name: string) => name.startsWith('.shared-'),
}));

vi.mock('@/config/constants', () => ({
  SYSTEM_FILES: new Set(['catalog.ttl', 'robots.txt', 'README', '.acl', '.meta']),
}));

function makeLeaf(uri: string) {
  return { uri } as any;
}

describe('isVisibleLeaf', () => {
  it('is defined', () => {
    expect(isVisibleLeaf).toBeDefined();
  });

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

  it('handles URI with trailing slash (empty pop result)', () => {
    // When URI ends with /, pop returns "", which is not a system file
    expect(isVisibleLeaf(makeLeaf('https://pod.example/files/'))).toBe(true);
  });

  it('handles empty URI', () => {
    expect(isVisibleLeaf(makeLeaf(''))).toBe(true);
  });
});

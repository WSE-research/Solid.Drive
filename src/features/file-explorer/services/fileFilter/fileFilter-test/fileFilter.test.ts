import { describe, it, expect, vi } from 'vitest';
import type { SolidContainer, SolidLeaf } from '@ldo/connected-solid';
import { isVisibleContainer, isVisibleContainerUri, isVisibleLeaf, isVisibleResourceUri } from '../fileFilter-file/fileFilter';

// Mock dependencies
vi.mock('@/infrastructure/solid/sharedCatalog', () => ({
  isSharedCatalogFile: (name: string) => name.startsWith('.shared-'),
}));

vi.mock('@/config/constants', () => ({
  SYSTEM_FILES: new Set(['catalog.ttl', 'robots.txt', 'README', '.acl', '.meta']),
  TRASH_CONTAINER_NAME: 'trash/',
}));

const storageRootUri = 'https://pod.example/';

function makeLeaf(uri: string) {
  return { uri } as SolidLeaf;
}

function makeContainer(uri: string) {
  return { uri } as SolidContainer;
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
    expect(isVisibleLeaf(makeLeaf('https://pod.example/files/'))).toBe(true);
  });

  it('returns true for an empty URI string since no system-file name matches', () => {
    expect(isVisibleLeaf(makeLeaf(''))).toBe(true);
  });

  it('stays visible even if the file name genuinely cannot be extracted from the URI', () => {
    const leaf = { uri: '' } as unknown as SolidLeaf;
    const original = Array.prototype.pop;
    Array.prototype.pop = function () { return undefined; };
    try {
      expect(isVisibleLeaf(leaf)).toBe(true);
    } finally {
      Array.prototype.pop = original;
    }
  });
});

describe('isVisibleResourceUri', () => {
  it('returns true for a normal catalog entry', () => {
    expect(isVisibleResourceUri('https://pod.example/files/photo/index.ttl')).toBe(true);
  });

  it('returns false for a shared-catalog helper file whose name is a URI-encoded WebID', () => {
    expect(
      isVisibleResourceUri(
        'https://pod.example/my-solid-app/.shared-https%3A%2F%2Fuser.example%2Fprofile%2Fcard.ttl',
      ),
    ).toBe(false);
  });

  it('returns false for a system file', () => {
    expect(isVisibleResourceUri('https://pod.example/my-solid-app/catalog.ttl')).toBe(false);
  });
});

describe('isVisibleContainerUri', () => {
  it('returns true for a normal folder', () => {
    expect(isVisibleContainerUri('https://pod.example/my-solid-app/photo-2024/', storageRootUri)).toBe(true);
  });

  it('returns false for the storage-root trash container', () => {
    expect(isVisibleContainerUri('https://pod.example/trash/', storageRootUri)).toBe(false);
  });

  it('returns false for the storage-root trash container even without a trailing slash', () => {
    expect(isVisibleContainerUri('https://pod.example/trash', storageRootUri)).toBe(false);
  });

  it('does not hide a folder that merely contains "trash" as part of its name', () => {
    expect(isVisibleContainerUri('https://pod.example/my-solid-app/trash-talk/', storageRootUri)).toBe(true);
  });

  it('does not hide a user folder literally named "trash" outside the storage root', () => {
    expect(isVisibleContainerUri('https://pod.example/my-solid-app/trash/', storageRootUri)).toBe(true);
  });
});

describe('isVisibleContainer', () => {
  it('returns true for a normal folder entry', () => {
    expect(isVisibleContainer(makeContainer('https://pod.example/my-solid-app/photo-2024/'), storageRootUri)).toBe(true);
  });

  it('returns false for the storage-root trash container entry', () => {
    expect(isVisibleContainer(makeContainer('https://pod.example/trash/'), storageRootUri)).toBe(false);
  });

  it('returns true for a user folder named "trash" that is not the storage-root trash container', () => {
    expect(isVisibleContainer(makeContainer('https://pod.example/my-solid-app/trash/'), storageRootUri)).toBe(true);
  });
});

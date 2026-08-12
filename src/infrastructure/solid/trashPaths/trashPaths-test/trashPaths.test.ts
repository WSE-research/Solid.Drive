import { describe, it, expect } from 'vitest';
import {
  getTrashContainerUri,
  getTrashCatalogUri,
  getTrashItemContainerUri,
  getTrashPayloadUri,
  getTombstoneUri,
  getAclSnapshotUri,
} from '../trashPaths-file/trashPaths';

describe('trashPaths', () => {
  const storageRootUri = 'https://pod.example/';
  const trashItemContainerUri = 'https://pod.example/trash/abc123/';

  it('builds the trash container URI under the storage root', () => {
    expect(getTrashContainerUri(storageRootUri)).toBe('https://pod.example/trash/');
  });

  it('builds the trash catalog URI reusing the default catalog filename', () => {
    expect(getTrashCatalogUri(storageRootUri)).toBe('https://pod.example/trash/catalog.ttl');
  });

  it('builds the trash item container URI from the caller-supplied id', () => {
    expect(getTrashItemContainerUri(storageRootUri, 'abc123')).toBe(trashItemContainerUri);
  });

  it('builds the fixed-name payload URI, ignoring the original filename', () => {
    expect(getTrashPayloadUri(trashItemContainerUri)).toBe(
      'https://pod.example/trash/abc123/payload',
    );
  });

  it('builds the tombstone URI', () => {
    expect(getTombstoneUri(trashItemContainerUri)).toBe(
      'https://pod.example/trash/abc123/tombstone.ttl',
    );
  });

  it('builds the ACL snapshot URI', () => {
    expect(getAclSnapshotUri(trashItemContainerUri)).toBe(
      'https://pod.example/trash/abc123/acl-snapshot.ttl',
    );
  });
});

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { CatalogEntry } from '@/types';
import type { SelectedResource } from '@/features/onedrive-layout/hooks/useSelectedResource';
import { useResourceDetails } from '../useResourceDetails-file/useResourceDetails';

vi.mock('@ldo/solid-react', () => ({
  useResource: () => ({
    uri: 'https://pod/app/folder/',
    children: () => [{ uri: 'a' }, { uri: 'b' }],
  }),
  useLdo: () => ({
    dataset: { match: () => [{ object: { value: '2026-05-01T00:00:00Z' } }] },
  }),
}));
vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isSolidContainer: () => true,
}));

const fileEntry: CatalogEntry = {
  uri: 'https://pod/app/doc/index.ttl',
  conformsTo: 'https://schema.org/MediaObject',
  title: 'doc.pdf',
  description: 'a description',
  modified: '2026-04-01T00:00:00Z',
  publisher: 'https://owner/me',
  mediaType: 'application/pdf',
  byteSize: 12345,
  accessURL: 'https://pod/app/doc/binary',
};

describe('useResourceDetails', () => {
  it('returns null when no resource is selected', () => {
    const { result } = renderHook(() =>
      useResourceDetails({ selection: null, catalogByContainer: new Map() }),
    );
    expect(result.current).toBeNull();
  });

  it('returns file details from the catalog when the selection is a file', () => {
    const selection: NonNullable<SelectedResource> = {
      kind: 'file',
      uri: 'https://pod/app/doc/',
      name: 'doc.pdf',
    };
    const map = new Map([['https://pod/app/doc/', fileEntry]]);
    const { result } = renderHook(() =>
      useResourceDetails({ selection, catalogByContainer: map }),
    );
    expect(result.current).toMatchObject({
      kind: 'file',
      uri: 'https://pod/app/doc/',
      name: 'doc.pdf',
      metadataUri: 'https://pod/app/doc/index.ttl',
      mediaType: 'application/pdf',
      conformsTo: 'https://schema.org/MediaObject',
      byteSize: 12345,
      modified: '2026-04-01T00:00:00Z',
    });
  });

  it('falls back to the selection name when the catalog has no entry', () => {
    const selection: NonNullable<SelectedResource> = {
      kind: 'file',
      uri: 'https://pod/app/missing/',
      name: 'fallback-name.pdf',
    };
    const { result } = renderHook(() =>
      useResourceDetails({ selection, catalogByContainer: new Map() }),
    );
    expect(result.current).toMatchObject({
      kind: 'file',
      name: 'fallback-name.pdf',
      mediaType: undefined,
      byteSize: undefined,
    });
  });

  it('returns folder details with item count when the selection is a folder', () => {
    const selection: NonNullable<SelectedResource> = {
      kind: 'folder',
      uri: 'https://pod/app/folder/',
      name: 'folder',
    };
    const { result } = renderHook(() =>
      useResourceDetails({ selection, catalogByContainer: new Map() }),
    );
    expect(result.current).toMatchObject({
      kind: 'folder',
      uri: 'https://pod/app/folder/',
      name: 'folder',
      itemCount: 2,
      modified: '2026-05-01T00:00:00Z',
    });
  });
});

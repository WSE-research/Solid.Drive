import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFolderBreadcrumbs } from '../useFolderBreadcrumbs-file/useFolderBreadcrumbs';
import { FOLDER_CLASS_URI } from '@/infrastructure/solid/catalog';
import type { FolderIndex, FolderNode } from '@/types';

const STORAGE_ROOT = 'https://pod.example/';

function node(partial: Omit<FolderNode, 'conformsTo'> & { conformsTo?: string }): FolderNode {
  return { conformsTo: FOLDER_CLASS_URI, ...partial };
}

function indexOf(...nodes: FolderNode[]): FolderIndex {
  return new Map(nodes.map((entry) => [entry.uri, entry]));
}

describe('useFolderBreadcrumbs', () => {
  it('returns an empty trail when currentUri is undefined', () => {
    const { result } = renderHook(() =>
      useFolderBreadcrumbs({
        currentUri: undefined,
        storageRootUri: STORAGE_ROOT,
        rootLabel: 'My Pod',
        folderIndex: new Map(),
        rootEntryFailed: false,
      }),
    );
    expect(result.current).toEqual({ breadcrumbs: [], error: null });
  });

  it('walks the catalog when the folder has an entry', () => {
    const photos = 'https://pod.example/my-solid-app/photos/';
    const app = 'https://pod.example/my-solid-app/';
    const folderIndex = indexOf(
      node({ uri: STORAGE_ROOT, title: '', parentUri: '' }),
      node({ uri: app, title: 'my-solid-app', parentUri: STORAGE_ROOT }),
      node({ uri: photos, title: 'Photos', parentUri: app }),
    );
    const { result } = renderHook(() =>
      useFolderBreadcrumbs({
        currentUri: photos,
        storageRootUri: STORAGE_ROOT,
        rootLabel: 'My Pod',
        folderIndex,
        rootEntryFailed: false,
      }),
    );
    expect(result.current.error).toBeNull();
    expect(result.current.breadcrumbs).toEqual([
      { label: 'My Pod', uri: STORAGE_ROOT },
      { label: 'my-solid-app', uri: app },
      { label: 'Photos', uri: photos },
    ]);
  });

  it('falls back to splitting the URI when the folder has no catalog entry at all', () => {
    const uncatalogued = 'https://pod.example/my-solid-app/legacy/';
    const { result } = renderHook(() =>
      useFolderBreadcrumbs({
        currentUri: uncatalogued,
        storageRootUri: STORAGE_ROOT,
        rootLabel: 'My Pod',
        folderIndex: new Map(),
        rootEntryFailed: false,
      }),
    );
    expect(result.current.error).toBeNull();
    expect(result.current.breadcrumbs.at(-1)).toMatchObject({ uri: uncatalogued });
  });

  it('upgrades a fallback segment label to its catalog title when the ancestor is known', () => {
    const app = 'https://pod.example/my-solid-app/';
    const uncatalogued = 'https://pod.example/my-solid-app/legacy/';
    const folderIndex = indexOf(node({ uri: app, title: 'My App', parentUri: STORAGE_ROOT }));
    const { result } = renderHook(() =>
      useFolderBreadcrumbs({
        currentUri: uncatalogued,
        storageRootUri: STORAGE_ROOT,
        rootLabel: 'My Pod',
        folderIndex,
        rootEntryFailed: false,
      }),
    );
    expect(result.current.breadcrumbs).toContainEqual({ label: 'My App', uri: app });
  });

  it('reports a FolderPathError when a current sd:Folder entry has a broken chain', () => {
    const orphan = 'https://pod.example/my-solid-app/orphan/';
    const folderIndex = indexOf(node({ uri: orphan, title: 'Orphan', parentUri: '' }));
    const { result } = renderHook(() =>
      useFolderBreadcrumbs({
        currentUri: orphan,
        storageRootUri: STORAGE_ROOT,
        rootLabel: 'My Pod',
        folderIndex,
        rootEntryFailed: false,
      }),
    );
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.reason).toBe('missing-parent');
    expect(result.current.breadcrumbs).toEqual([{ label: 'My Pod', uri: STORAGE_ROOT }]);
  });

  it('falls back to splitting the URI, without reporting an error, when the root entry has not loaded yet', () => {
    const photos = 'https://pod.example/my-solid-app/photos/';
    const app = 'https://pod.example/my-solid-app/';
    // storageRootUri has no entry in folderIndex, unlike a normal broken
    // chain: this is the startup race where the root's proactive write
    // hasn't landed yet, not a data defect.
    const folderIndex = indexOf(
      node({ uri: app, title: 'my-solid-app', parentUri: STORAGE_ROOT }),
      node({ uri: photos, title: 'Photos', parentUri: app }),
    );
    const { result } = renderHook(() =>
      useFolderBreadcrumbs({
        currentUri: photos,
        storageRootUri: STORAGE_ROOT,
        rootLabel: 'My Pod',
        folderIndex,
        rootEntryFailed: false,
      }),
    );
    expect(result.current.error).toBeNull();
    expect(result.current.breadcrumbs.length).toBeGreaterThan(1);
    expect(result.current.breadcrumbs.at(-1)).toMatchObject({ uri: photos });
  });

  it('reports a FolderPathError for a missing root once the registration write is confirmed failed', () => {
    const photos = 'https://pod.example/my-solid-app/photos/';
    const app = 'https://pod.example/my-solid-app/';
    const folderIndex = indexOf(
      node({ uri: app, title: 'my-solid-app', parentUri: STORAGE_ROOT }),
      node({ uri: photos, title: 'Photos', parentUri: app }),
    );
    const { result } = renderHook(() =>
      useFolderBreadcrumbs({
        currentUri: photos,
        storageRootUri: STORAGE_ROOT,
        rootLabel: 'My Pod',
        folderIndex,
        rootEntryFailed: true,
      }),
    );
    expect(result.current.error?.reason).toBe('missing-entry');
    expect(result.current.error?.atUri).toBe(STORAGE_ROOT);
    expect(result.current.breadcrumbs).toEqual([{ label: 'My Pod', uri: STORAGE_ROOT }]);
  });

  it('shows the trail up to a legacy folder with no hasParent, without reporting an error', () => {
    const legacy = 'https://pod.example/my-solid-app/cat-test/';
    const folderIndex = indexOf(
      node({ uri: legacy, title: 'cat-test', parentUri: '', conformsTo: 'http://www.w3.org/ns/ldp#Container' }),
    );
    const { result } = renderHook(() =>
      useFolderBreadcrumbs({
        currentUri: legacy,
        storageRootUri: STORAGE_ROOT,
        rootLabel: 'My Pod',
        folderIndex,
        rootEntryFailed: false,
      }),
    );
    expect(result.current.error).toBeNull();
    expect(result.current.breadcrumbs).toEqual([{ label: 'cat-test', uri: legacy }]);
  });
});

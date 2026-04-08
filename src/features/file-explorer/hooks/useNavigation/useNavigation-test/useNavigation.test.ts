import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNavigation } from '../useNavigation-file/useNavigation';
import type { SolidContainerUri } from '@ldo/connected-solid';

describe('useNavigation', () => {
  it('is defined', () => {
    expect(useNavigation).toBeDefined();
  });

  it('initializes with undefined currentUri when no args given', () => {
    const { result } = renderHook(() => useNavigation());
    expect(result.current.currentUri).toBeUndefined();
    expect(result.current.breadcrumbs).toEqual([]);
  });

  it('initializes with given URI and label', () => {
    const uri = 'https://pod.example/root/' as SolidContainerUri;
    const { result } = renderHook(() => useNavigation(uri, 'Root'));
    expect(result.current.currentUri).toBe(uri);
    expect(result.current.breadcrumbs).toEqual([{ label: 'Root', uri }]);
  });

  it('initializes with empty breadcrumbs when only uri is given without label', () => {
    const uri = 'https://pod.example/root/' as SolidContainerUri;
    const { result } = renderHook(() => useNavigation(uri));
    expect(result.current.currentUri).toBe(uri);
    expect(result.current.breadcrumbs).toEqual([]);
  });

  it('handleNavigate updates currentUri and adds breadcrumb', () => {
    const root = 'https://pod.example/root/' as SolidContainerUri;
    const { result } = renderHook(() => useNavigation(root, 'Root'));

    act(() => {
      result.current.handleNavigate('https://pod.example/root/folder/');
    });

    expect(result.current.currentUri).toBe('https://pod.example/root/folder/');
    expect(result.current.breadcrumbs).toHaveLength(2);
    expect(result.current.breadcrumbs[1]).toEqual({
      label: 'folder',
      uri: 'https://pod.example/root/folder/',
    });
  });

  it('handleNavigate decodes URI-encoded folder names', () => {
    const root = 'https://pod.example/root/' as SolidContainerUri;
    const { result } = renderHook(() => useNavigation(root, 'Root'));

    act(() => {
      result.current.handleNavigate('https://pod.example/root/my%20folder/');
    });

    expect(result.current.breadcrumbs[1].label).toBe('my folder');
  });

  it('handleNavigate strips trailing slash from label extraction', () => {
    const { result } = renderHook(() => useNavigation());

    act(() => {
      result.current.handleNavigate('https://pod.example/root/docs/');
    });

    expect(result.current.breadcrumbs[0].label).toBe('docs');
  });

  it('handleBreadcrumbClick trims breadcrumbs and sets currentUri', () => {
    const root = 'https://pod.example/root/' as SolidContainerUri;
    const { result } = renderHook(() => useNavigation(root, 'Root'));

    act(() => {
      result.current.handleNavigate('https://pod.example/root/a/');
      result.current.handleNavigate('https://pod.example/root/a/b/');
    });
    expect(result.current.breadcrumbs).toHaveLength(3);

    act(() => {
      result.current.handleBreadcrumbClick(0, root);
    });

    expect(result.current.currentUri).toBe(root);
    expect(result.current.breadcrumbs).toHaveLength(1);
    expect(result.current.breadcrumbs[0].label).toBe('Root');
  });

  it('setCurrentUri directly updates the URI', () => {
    const { result } = renderHook(() => useNavigation());
    const newUri = 'https://pod.example/other/' as SolidContainerUri;

    act(() => {
      result.current.setCurrentUri(newUri);
    });

    expect(result.current.currentUri).toBe(newUri);
  });

  it('setBreadcrumbs directly updates breadcrumbs', () => {
    const { result } = renderHook(() => useNavigation());
    const uri = 'https://pod.example/x/' as SolidContainerUri;

    act(() => {
      result.current.setBreadcrumbs([{ label: 'X', uri }]);
    });

    expect(result.current.breadcrumbs).toEqual([{ label: 'X', uri }]);
  });

  it('handleNavigate accumulates multiple breadcrumbs', () => {
    const { result } = renderHook(() => useNavigation());

    act(() => {
      result.current.handleNavigate('https://pod.example/a/');
      result.current.handleNavigate('https://pod.example/a/b/');
      result.current.handleNavigate('https://pod.example/a/b/c/');
    });

    expect(result.current.breadcrumbs).toHaveLength(3);
    expect(result.current.breadcrumbs.map((b: any) => b.label)).toEqual(['a', 'b', 'c']);
  });

  it('handleBreadcrumbClick at last index keeps all breadcrumbs', () => {
    const root = 'https://pod.example/root/' as SolidContainerUri;
    const { result } = renderHook(() => useNavigation(root, 'Root'));

    act(() => {
      result.current.handleNavigate('https://pod.example/root/sub/');
    });

    act(() => {
      result.current.handleBreadcrumbClick(1, 'https://pod.example/root/sub/' as SolidContainerUri);
    });

    expect(result.current.breadcrumbs).toHaveLength(2);
    expect(result.current.currentUri).toBe('https://pod.example/root/sub/');
  });
});

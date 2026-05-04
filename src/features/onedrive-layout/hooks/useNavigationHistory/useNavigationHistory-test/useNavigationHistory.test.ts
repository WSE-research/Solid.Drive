import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { SolidContainerUri } from '@ldo/connected-solid';
import { useNavigationHistory } from '../useNavigationHistory-file/useNavigationHistory';

type Breadcrumb = { label: string; uri: SolidContainerUri };

const ROOT: Breadcrumb = {
  label: 'My Pod',
  uri: 'https://pod/app/' as SolidContainerUri,
};
const CHILD: Breadcrumb = {
  label: 'docs',
  uri: 'https://pod/app/docs/' as SolidContainerUri,
};

describe('useNavigationHistory', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('navigate pushes history state and updates the navigation', () => {
    const setCurrentUri = vi.fn();
    const setBreadcrumbs = vi.fn();
    const { result } = renderHook(() =>
      useNavigationHistory({
        currentUri: ROOT.uri,
        breadcrumbs: [ROOT],
        setCurrentUri,
        setBreadcrumbs,
      }),
    );
    act(() => result.current.navigate(CHILD.uri, CHILD.label));
    expect(setCurrentUri).toHaveBeenCalledWith(CHILD.uri);
    expect(setBreadcrumbs).toHaveBeenCalledWith([ROOT, CHILD]);
    expect(window.history.state).toMatchObject({
      marker: 'odl-my-files',
      currentUri: CHILD.uri,
    });
  });

  it('navigateToCrumb slices breadcrumbs and pushes history', () => {
    const setCurrentUri = vi.fn();
    const setBreadcrumbs = vi.fn();
    const { result } = renderHook(() =>
      useNavigationHistory({
        currentUri: CHILD.uri,
        breadcrumbs: [ROOT, CHILD],
        setCurrentUri,
        setBreadcrumbs,
      }),
    );
    act(() => result.current.navigateToCrumb(0, ROOT.uri));
    expect(setCurrentUri).toHaveBeenCalledWith(ROOT.uri);
    expect(setBreadcrumbs).toHaveBeenCalledWith([ROOT]);
  });

  it('popstate restores breadcrumbs and current uri from history state', () => {
    const setCurrentUri = vi.fn();
    const setBreadcrumbs = vi.fn();
    renderHook(() =>
      useNavigationHistory({
        currentUri: CHILD.uri,
        breadcrumbs: [ROOT, CHILD],
        setCurrentUri,
        setBreadcrumbs,
      }),
    );
    act(() => {
      const event = new PopStateEvent('popstate', {
        state: {
          marker: 'odl-my-files',
          currentUri: ROOT.uri,
          breadcrumbs: [ROOT],
        },
      });
      window.dispatchEvent(event);
    });
    expect(setCurrentUri).toHaveBeenCalledWith(ROOT.uri);
    expect(setBreadcrumbs).toHaveBeenCalledWith([ROOT]);
  });

  it('popstate ignores unrelated history entries', () => {
    const setCurrentUri = vi.fn();
    const setBreadcrumbs = vi.fn();
    renderHook(() =>
      useNavigationHistory({
        currentUri: ROOT.uri,
        breadcrumbs: [ROOT],
        setCurrentUri,
        setBreadcrumbs,
      }),
    );
    act(() => {
      window.dispatchEvent(
        new PopStateEvent('popstate', { state: { other: 'thing' } }),
      );
    });
    expect(setCurrentUri).not.toHaveBeenCalled();
    expect(setBreadcrumbs).not.toHaveBeenCalled();
  });

  it('attachScrollContainer captures the scroll element without throwing', () => {
    const { result } = renderHook(() =>
      useNavigationHistory({
        currentUri: ROOT.uri,
        breadcrumbs: [ROOT],
        setCurrentUri: vi.fn(),
        setBreadcrumbs: vi.fn(),
      }),
    );
    const element = document.createElement('div');
    expect(() => result.current.attachScrollContainer(element)).not.toThrow();
    expect(() => result.current.attachScrollContainer(null)).not.toThrow();
  });
});

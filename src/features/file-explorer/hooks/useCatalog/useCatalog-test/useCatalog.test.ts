import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mockFetch = vi.fn();
vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ fetch: mockFetch }),
  // `useCatalog` subscribes to the catalog resource so notifications
  // trigger re-fetches. The hook only reads `resource.status` from the
  // result to detect updates; tests do not exercise that path.
  useResource: () => undefined,
}));

const mockParseCatalog = vi.fn();
vi.mock('@/infrastructure/solid/catalog', () => ({
  parseCatalog: (...args: unknown[]) => mockParseCatalog(...args),
}));

vi.mock('@/infrastructure/solid/sharedCatalog', () => ({
  toContainerUri: (uri: string) => uri.replace(/index\.ttl$/, ''),
}));

import { useCatalog } from '../useCatalog-file/useCatalog';

const CATALOG_URI = 'https://pod.example/catalog.ttl';

describe('useCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('TTL') });
    mockParseCatalog.mockReturnValue([]);
  });

  it('returns empty state when catalogUri is undefined', () => {
    const { result } = renderHook(() => useCatalog(undefined));
    expect(result.current.entries).toEqual([]);
    expect(result.current.containerUris).toEqual(new Set());
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches, parses, and exposes entries + containerUris', async () => {
    const reportEntryUri = 'https://pod.example/report/index.ttl';
    const invoiceEntryUri = 'https://pod.example/invoice/index.ttl';
    mockParseCatalog.mockReturnValue([
      { uri: reportEntryUri, title: 'Report' },
      { uri: invoiceEntryUri, title: 'Invoice' },
    ]);
    const { result } = renderHook(() => useCatalog(CATALOG_URI));
    await waitFor(() => expect(result.current.entries).toHaveLength(2));
    expect(mockFetch).toHaveBeenCalledWith(CATALOG_URI);
    expect(result.current.containerUris).toEqual(
      new Set(['https://pod.example/report/', 'https://pod.example/invoice/'])
    );
  });

  it('returns empty state when fetch is not ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve('') });
    const { result } = renderHook(() => useCatalog(CATALOG_URI));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetch).toHaveBeenCalled();
    expect(result.current.entries).toEqual([]);
    expect(result.current.containerUris).toEqual(new Set());
  });

  it('does not update state after unmount', async () => {
    let resolveTurtleText: ((turtleText: string) => void) | undefined;
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => new Promise<string>((resolve) => { resolveTurtleText = resolve; }),
    });
    mockParseCatalog.mockReturnValue([{ uri: 'https://pod.example/report/index.ttl' }]);
    const { result, unmount } = renderHook(() => useCatalog(CATALOG_URI));
    // Allow the fetch microtask to flush so response.text() is invoked and captures resolveTurtleText.
    await waitFor(() => expect(resolveTurtleText).toBeDefined());
    unmount();
    resolveTurtleText?.('TTL');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.entries).toEqual([]);
  });

  it('refetches when catalogUri changes', async () => {
    const OTHER_CATALOG_URI = 'https://pod.example/other.ttl';
    const { rerender } = renderHook(
      ({ currentCatalogUri }: { currentCatalogUri: string }) => useCatalog(currentCatalogUri),
      { initialProps: { currentCatalogUri: CATALOG_URI } },
    );
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(CATALOG_URI));
    rerender({ currentCatalogUri: OTHER_CATALOG_URI });
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(OTHER_CATALOG_URI));
  });

  it('exposes errors thrown by fetch without crashing', async () => {
    mockFetch.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useCatalog(CATALOG_URI));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.entries).toEqual([]);
  });

  it('wraps a non-Error thrown value into an Error before exposing it', async () => {
    mockFetch.mockRejectedValue('plain string boom');
    const { result } = renderHook(() => useCatalog(CATALOG_URI));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.error?.message).toBe('plain string boom');
    expect(result.current.entries).toEqual([]);
  });

  it('reports loading=true while a fetch is in flight and false after it settles', async () => {
    let resolveFetch: ((value: { ok: boolean; text: () => Promise<string> }) => void) | undefined;
    mockFetch.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));
    const { result } = renderHook(() => useCatalog(CATALOG_URI));
    await waitFor(() => expect(result.current.loading).toBe(true));
    resolveFetch?.({ ok: true, text: () => Promise.resolve('TTL') });
    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const mockFetch = vi.fn();
vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ fetch: mockFetch }),
}));

const FOLDER_CLASS_URI = 'http://www.w3.org/ns/ldp#Container';
const mockParseCatalogRecovering = vi.fn();
vi.mock('@/infrastructure/solid/catalog', () => ({
  isFolderEntry: (entry: { conformsTo: string }) => entry.conformsTo === FOLDER_CLASS_URI,
  parseCatalogRecovering: (...args: unknown[]) => mockParseCatalogRecovering(...args),
}));

vi.mock('@/infrastructure/solid/sharedCatalog', () => ({
  toContainerUri: (uri: string) => uri.replace(/index\.ttl$/, ''),
}));

import {
  __resetCatalogCacheForTests,
  useCatalog,
} from '../useCatalog-file/useCatalog';
import {
  __resetCatalogVersionsForTests,
  notifyCatalogChanged,
} from '@/shared/hooks/useCatalogVersion';

const CATALOG_URI = 'https://pod.example/catalog.ttl';

// `parseCatalogRecovering` never throws; a clean parse reports error: null.
const entries = (parsed: unknown[]) => ({ entries: parsed, error: null });

describe('useCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetCatalogCacheForTests();
    __resetCatalogVersionsForTests();
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('TTL') });
    mockParseCatalogRecovering.mockReturnValue(entries([]));
  });

  it('returns empty state when catalogUri is undefined', () => {
    const { result } = renderHook(() => useCatalog(undefined));
    expect(result.current.entries).toEqual([]);
    expect(result.current.containerUris).toEqual(new Set());
    expect(result.current.folderTitles).toEqual(new Map());
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('puts folder entries in folderTitles and folderEntries, leaving them out of entries and containerUris', async () => {
    const reportEntryUri = 'https://pod.example/report/index.ttl';
    const folderUri = 'https://pod.example/documents/';
    const folderEntry = { uri: folderUri, title: 'Documents', conformsTo: FOLDER_CLASS_URI };
    mockParseCatalogRecovering.mockReturnValue(entries([
      { uri: reportEntryUri, title: 'Report', conformsTo: '' },
      folderEntry,
    ]));
    const { result } = renderHook(() => useCatalog(CATALOG_URI));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.entries).toEqual([{ uri: reportEntryUri, title: 'Report', conformsTo: '' }]);
    expect(result.current.containerUris).toEqual(new Set(['https://pod.example/report/']));
    expect(result.current.folderTitles).toEqual(new Map([[folderUri, 'Documents']]));
    // A caller that needs the full folder rows themselves, not just the
    // trimmed folderIndex shape, reads them from here (useTrashEntries,
    // since the trash catalog is flat and has no use for the split).
    expect(result.current.folderEntries).toEqual([folderEntry]);
  });

  it('keeps the same folderEntries array reference across re-renders when the catalog has not changed', async () => {
    mockParseCatalogRecovering.mockReturnValue(entries([
      { uri: 'https://pod.example/documents/', title: 'Documents', conformsTo: FOLDER_CLASS_URI },
    ]));
    const { result, rerender } = renderHook(() => useCatalog(CATALOG_URI));
    await waitFor(() => expect(result.current.folderEntries).toHaveLength(1));
    const firstFolderEntries = result.current.folderEntries;

    rerender();
    expect(result.current.folderEntries).toBe(firstFolderEntries);
  });

  it('fetches the catalog and returns the parsed entries and containerUris', async () => {
    const reportEntryUri = 'https://pod.example/report/index.ttl';
    const invoiceEntryUri = 'https://pod.example/invoice/index.ttl';
    mockParseCatalogRecovering.mockReturnValue(entries([
      { uri: reportEntryUri, title: 'Report' },
      { uri: invoiceEntryUri, title: 'Invoice' },
    ]));
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
    expect(result.current.error).toBeNull();
  });

  it('does not update state after unmount', async () => {
    let resolveTurtleText: ((turtleText: string) => void) | undefined;
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => new Promise<string>((resolve) => { resolveTurtleText = resolve; }),
    });
    mockParseCatalogRecovering.mockReturnValue(entries([{ uri: 'https://pod.example/report/index.ttl' }]));
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

  it('surfaces a malformed catalog as an error, with no entries, when nothing could be recovered', async () => {
    mockParseCatalogRecovering.mockReturnValue({
      entries: [],
      error: new Error(`${CATALOG_URI} contains invalid Turtle and could not be read.`),
    });
    const { result } = renderHook(() => useCatalog(CATALOG_URI));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.error?.message).toContain('invalid Turtle');
    expect(result.current.entries).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('shows the entries recovered from a partially corrupted catalog alongside the error', async () => {
    const goodEntryUri = 'https://pod.example/report/index.ttl';
    mockParseCatalogRecovering.mockReturnValue({
      entries: [{ uri: goodEntryUri, title: 'Report', conformsTo: '' }],
      error: new Error(`${CATALOG_URI} contains invalid Turtle and could not be read.`),
    });
    const { result } = renderHook(() => useCatalog(CATALOG_URI));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.entries).toEqual([{ uri: goodEntryUri, title: 'Report', conformsTo: '' }]);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('reports loading as true while fetching and false once it settles', async () => {
    let resolveFetch: ((value: { ok: boolean; text: () => Promise<string> }) => void) | undefined;
    mockFetch.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));
    const { result } = renderHook(() => useCatalog(CATALOG_URI));
    await waitFor(() => expect(result.current.loading).toBe(true));
    resolveFetch?.({ ok: true, text: () => Promise.resolve('TTL') });
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('keeps serving the last-known entries while re-fetching the same catalog', async () => {
    mockParseCatalogRecovering.mockReturnValueOnce(entries([
      { uri: 'https://pod.example/report/index.ttl', title: 'Report' },
    ]));
    const { result } = renderHook(() => useCatalog(CATALOG_URI));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));

    // A confirmed write elsewhere bumps the version and re-fetches the same
    // catalog. Hold that re-fetch open so we can inspect the mid-flight state.
    let resolveRefetch: ((value: { ok: boolean; text: () => Promise<string> }) => void) | undefined;
    mockFetch.mockReturnValueOnce(new Promise((resolve) => { resolveRefetch = resolve; }));
    act(() => notifyCatalogChanged(CATALOG_URI));

    await waitFor(() => expect(result.current.loading).toBe(true));
    // The previous entries stay visible instead of flashing empty.
    expect(result.current.entries).toHaveLength(1);

    resolveRefetch?.({ ok: true, text: () => Promise.resolve('TTL') });
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('keeps serving the last-known folder titles while re-fetching the same catalog', async () => {
    const folderUri = 'https://pod.example/documents/';
    // Returned on both the initial fetch and the refetch below, so the final
    // assertion confirms the titles are still correct, not just unchanged.
    mockParseCatalogRecovering.mockReturnValue(entries([
      { uri: folderUri, title: 'Documents', conformsTo: FOLDER_CLASS_URI },
    ]));
    const { result } = renderHook(() => useCatalog(CATALOG_URI));
    await waitFor(() => expect(result.current.folderTitles).toEqual(new Map([[folderUri, 'Documents']])));

    let resolveRefetch: ((value: { ok: boolean; text: () => Promise<string> }) => void) | undefined;
    mockFetch.mockReturnValueOnce(new Promise((resolve) => { resolveRefetch = resolve; }));
    act(() => notifyCatalogChanged(CATALOG_URI));

    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.folderTitles).toEqual(new Map([[folderUri, 'Documents']]));

    resolveRefetch?.({ ok: true, text: () => Promise.resolve('TTL') });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.folderTitles).toEqual(new Map([[folderUri, 'Documents']]));
  });

  it('does not re-fetch on its own — only catalogUri changing or notifyCatalogChanged does', async () => {
    mockParseCatalogRecovering.mockReturnValueOnce(entries([
      { uri: 'https://pod.example/report/index.ttl', title: 'Report' },
    ]));
    const { result, rerender } = renderHook(() => useCatalog(CATALOG_URI));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    const fetchCountAfterFirst = mockFetch.mock.calls.length;

    // Plain re-renders (no catalogUri change, no notifyCatalogChanged) must
    // never trigger another fetch.
    rerender();
    rerender();
    rerender();
    expect(mockFetch.mock.calls.length).toBe(fetchCountAfterFirst);
    expect(result.current.entries).toHaveLength(1);
  });

  it('serves a second hook instance from the cache instead of fetching again', async () => {
    mockParseCatalogRecovering.mockReturnValue(entries([
      { uri: 'https://pod.example/report/index.ttl', title: 'Report' },
    ]));
    const { result: first } = renderHook(() => useCatalog(CATALOG_URI));
    await waitFor(() => expect(first.current.entries).toHaveLength(1));
    const fetchCountAfterFirst = mockFetch.mock.calls.length;

    const { result: second } = renderHook(() => useCatalog(CATALOG_URI));
    expect(second.current.entries).toEqual(first.current.entries);
    expect(second.current.loading).toBe(false);
    expect(mockFetch.mock.calls.length).toBe(fetchCountAfterFirst);
  });
});

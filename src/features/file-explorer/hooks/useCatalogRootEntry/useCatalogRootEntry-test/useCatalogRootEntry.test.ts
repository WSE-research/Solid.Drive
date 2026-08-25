import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mockFetch = vi.fn();
const mockWebId = 'https://pod.example/profile/card#me';
vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ session: { webId: mockWebId }, fetch: mockFetch }),
}));

const mockEnsureCatalogRootEntry = vi.fn();
vi.mock('@/infrastructure/solid/catalog', () => ({
  ensureCatalogRootEntry: (...args: unknown[]) => mockEnsureCatalogRootEntry(...args),
}));

const mockNotifyCatalogChanged = vi.fn();
vi.mock('@/shared/hooks/useCatalogVersion', () => ({
  notifyCatalogChanged: (...args: unknown[]) => mockNotifyCatalogChanged(...args),
}));

import { useCatalogRootEntry } from '../useCatalogRootEntry-file/useCatalogRootEntry';

const catalogUri = 'https://pod.example/catalog.ttl';
const storageRootUri = 'https://pod.example/';

describe('useCatalogRootEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureCatalogRootEntry.mockResolvedValue(undefined);
  });

  it('does nothing when catalogUri is undefined', () => {
    renderHook(() => useCatalogRootEntry(undefined, storageRootUri, false));
    expect(mockEnsureCatalogRootEntry).not.toHaveBeenCalled();
  });

  it('does nothing when storageRootUri is undefined', () => {
    renderHook(() => useCatalogRootEntry(catalogUri, undefined, false));
    expect(mockEnsureCatalogRootEntry).not.toHaveBeenCalled();
  });

  it('starts pending, then registers the storage root once both URIs are known', () => {
    const { result } = renderHook(() => useCatalogRootEntry(catalogUri, storageRootUri, false));
    expect(result.current).toBe('pending');
    expect(mockEnsureCatalogRootEntry).toHaveBeenCalledWith({
      catalogUri,
      storageRootUri,
      publisherWebId: mockWebId,
      fetch: mockFetch,
    });
  });

  it('reports succeeded once the write resolves', async () => {
    const { result } = renderHook(() => useCatalogRootEntry(catalogUri, storageRootUri, false));
    await waitFor(() => expect(result.current).toBe('succeeded'));
  });

  it('reports failed once the write rejects, instead of staying pending forever', async () => {
    mockEnsureCatalogRootEntry.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useCatalogRootEntry(catalogUri, storageRootUri, false));
    await waitFor(() => expect(result.current).toBe('failed'));
  });

  it('skips the write entirely when rootAlreadyPresent is true', () => {
    const { result } = renderHook(() => useCatalogRootEntry(catalogUri, storageRootUri, true));
    expect(result.current).toBe('succeeded');
    expect(mockEnsureCatalogRootEntry).not.toHaveBeenCalled();
  });

  it('does not re-register on a re-render with the same URIs', () => {
    const { rerender } = renderHook(
      ({ uri }: { uri: string }) => useCatalogRootEntry(uri, storageRootUri, false),
      { initialProps: { uri: catalogUri } },
    );
    rerender({ uri: catalogUri });
    expect(mockEnsureCatalogRootEntry).toHaveBeenCalledTimes(1);
  });

  it('registers again when catalogUri changes', () => {
    const otherCatalogUri = 'https://pod.example/other.ttl';
    const { rerender } = renderHook(
      ({ uri }: { uri: string }) => useCatalogRootEntry(uri, storageRootUri, false),
      { initialProps: { uri: catalogUri } },
    );
    rerender({ uri: otherCatalogUri });
    expect(mockEnsureCatalogRootEntry).toHaveBeenCalledTimes(2);
    expect(mockEnsureCatalogRootEntry).toHaveBeenLastCalledWith(
      expect.objectContaining({ catalogUri: otherCatalogUri }),
    );
  });

  it('swallows a rejection instead of throwing', async () => {
    mockEnsureCatalogRootEntry.mockRejectedValue(new Error('boom'));
    expect(() => renderHook(() => useCatalogRootEntry(catalogUri, storageRootUri, false))).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockNotifyCatalogChanged).not.toHaveBeenCalled();
  });

  it('notifies useCatalog to refetch once the root entry write succeeds', async () => {
    renderHook(() => useCatalogRootEntry(catalogUri, storageRootUri, false));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockNotifyCatalogChanged).toHaveBeenCalledWith(catalogUri);
  });

  it('does not re-register when rootAlreadyPresent flips back to false after a success, e.g. during an unrelated catalog refetch', async () => {
    const { result, rerender } = renderHook(
      ({ present }: { present: boolean }) => useCatalogRootEntry(catalogUri, storageRootUri, present),
      { initialProps: { present: false } },
    );
    await waitFor(() => expect(result.current).toBe('succeeded'));
    expect(mockEnsureCatalogRootEntry).toHaveBeenCalledTimes(1);

    // Simulates useCatalog's `loading` flag toggling true then false again
    // for an unrelated write (an upload, a delete elsewhere in the app).
    rerender({ present: true });
    rerender({ present: false });
    expect(mockEnsureCatalogRootEntry).toHaveBeenCalledTimes(1);
  });

  it('retries on the next flip after a failed attempt', async () => {
    mockEnsureCatalogRootEntry.mockRejectedValueOnce(new Error('boom'));
    const { result, rerender } = renderHook(
      ({ present }: { present: boolean }) => useCatalogRootEntry(catalogUri, storageRootUri, present),
      { initialProps: { present: false } },
    );
    await waitFor(() => expect(result.current).toBe('failed'));
    expect(mockEnsureCatalogRootEntry).toHaveBeenCalledTimes(1);

    mockEnsureCatalogRootEntry.mockResolvedValueOnce(undefined);
    rerender({ present: true });
    rerender({ present: false });
    await waitFor(() => expect(result.current).toBe('succeeded'));
    expect(mockEnsureCatalogRootEntry).toHaveBeenCalledTimes(2);
  });
});

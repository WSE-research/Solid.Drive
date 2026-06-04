import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { CatalogEntry } from '@/types';

const mockDiscoverInboxUri = vi.fn();
const mockPostFileAccessRequest = vi.fn();
const mockPostTypeAccessRequest = vi.fn();
const mockDeleteAccessRequest = vi.fn();

vi.mock('@/infrastructure/inbox/inboxAccess', () => ({
  discoverInboxUri: (...args: unknown[]) => mockDiscoverInboxUri(...args),
  postFileAccessRequest: (...args: unknown[]) => mockPostFileAccessRequest(...args),
  postTypeAccessRequest: (...args: unknown[]) => mockPostTypeAccessRequest(...args),
  deleteAccessRequest: (...args: unknown[]) => mockDeleteAccessRequest(...args),
}));

vi.mock('@/infrastructure/solid/sharedCatalog', () => ({
  toContainerUri: (uri: string) =>
    uri.endsWith('/') ? uri : uri.slice(0, uri.lastIndexOf('/') + 1),
}));

import { useFileAccessRequests } from '../useAccessRequests-file/useAccessRequests';

const solidFetch = vi.fn() as unknown as typeof fetch;
const onClearOutcome = vi.fn();

const makeEntry = (uri: string, title: string): CatalogEntry => ({
  uri, title, conformsTo: '', description: '', modified: '', publisher: '', mediaType: '', byteSize: 0, accessURL: '',
});

const entryA = makeEntry('https://pod.example/app/doc1/index.ttl', 'Document 1');
const entryB = makeEntry('https://pod.example/app/doc2/index.ttl', 'Document 2');
const CONTAINER_A = 'https://pod.example/app/doc1/';
const CONTAINER_B = 'https://pod.example/app/doc2/';
const classUri = 'http://schema.org/ImageObject';

const baseParams = {
  contactWebId: 'https://contact.example/profile/card#me',
  viewerWebId: 'https://viewer.example/profile/card#me',
  solidFetch,
  entries: [entryA, entryB],
  classUri,
  onClearOutcome,
};

describe('useFileAccessRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockDiscoverInboxUri.mockResolvedValue('https://contact.example/inbox/');
    mockPostFileAccessRequest.mockResolvedValue(undefined);
    mockPostTypeAccessRequest.mockResolvedValue(undefined);
    mockDeleteAccessRequest.mockResolvedValue(undefined);
  });

  it('starts with nothing pending and no failures', () => {
    const { result } = renderHook(() => useFileAccessRequests(baseParams));
    expect(result.current.allPending).toBe(false);
    expect(result.current.failedUris.size).toBe(0);
  });

  it('reports allPending false when there are no entries', () => {
    const { result } = renderHook(() => useFileAccessRequests({ ...baseParams, entries: [] }));
    expect(result.current.allPending).toBe(false);
  });

  it('sends one category request and marks every entry pending', async () => {
    const { result } = renderHook(() => useFileAccessRequests(baseParams));
    await act(async () => { await result.current.handleRequestAll(); });
    expect(mockPostTypeAccessRequest).toHaveBeenCalledTimes(1);
    expect(mockPostFileAccessRequest).not.toHaveBeenCalled();
    expect(result.current.allPending).toBe(true);
  });

  it('passes the classUri to postTypeAccessRequest', async () => {
    const { result } = renderHook(() => useFileAccessRequests(baseParams));
    await act(async () => { await result.current.handleRequestAll(); });
    expect(mockPostTypeAccessRequest).toHaveBeenCalledWith(
      'https://contact.example/inbox/',
      'https://viewer.example/profile/card#me',
      classUri,
      solidFetch,
    );
  });

  it('rolls back pending and flags every entry failed when the bulk request fails', async () => {
    mockPostTypeAccessRequest.mockRejectedValue(new Error('post failed'));
    const { result } = renderHook(() => useFileAccessRequests(baseParams));
    await act(async () => { await result.current.handleRequestAll(); });
    expect(result.current.allPending).toBe(false);
    expect(result.current.failedUris.has(CONTAINER_A)).toBe(true);
    expect(result.current.failedUris.has(CONTAINER_B)).toBe(true);
  });

  it('requests a single file by its container URI', async () => {
    const { result } = renderHook(() => useFileAccessRequests(baseParams));
    await act(async () => { await result.current.handleRequestFile(entryA); });
    expect(mockPostFileAccessRequest).toHaveBeenCalledWith(
      'https://contact.example/inbox/',
      'https://viewer.example/profile/card#me',
      CONTAINER_A,
      solidFetch,
    );
  });

  it('flags a single file failed when its request fails', async () => {
    mockDiscoverInboxUri.mockRejectedValue(new Error('inbox error'));
    const { result } = renderHook(() => useFileAccessRequests(baseParams));
    await act(async () => { await result.current.handleRequestFile(entryA); });
    expect(result.current.failedUris.has(CONTAINER_A)).toBe(true);
  });

  it('clears the failed flag once a retry succeeds', async () => {
    mockDiscoverInboxUri.mockRejectedValueOnce(new Error('inbox error'));
    const { result } = renderHook(() => useFileAccessRequests(baseParams));
    await act(async () => { await result.current.handleRequestFile(entryA); });
    expect(result.current.failedUris.has(CONTAINER_A)).toBe(true);
    await act(async () => { await result.current.handleRequestFile(entryA); });
    expect(result.current.failedUris.has(CONTAINER_A)).toBe(false);
  });

  it('allPending turns true only once every file is requested', async () => {
    const { result } = renderHook(() => useFileAccessRequests(baseParams));
    await act(async () => { await result.current.handleRequestFile(entryA); });
    expect(result.current.allPending).toBe(false);
    await act(async () => { await result.current.handleRequestFile(entryB); });
    expect(result.current.allPending).toBe(true);
  });

  const OUTCOME_URI = 'https://viewer.example/inbox/outcome1';

  it('deletes the prior outcome notice, clears it, and re-requests', async () => {
    const { result } = renderHook(() => useFileAccessRequests(baseParams));
    await act(async () => { await result.current.handleRequestAgain(entryA, OUTCOME_URI); });
    expect(mockDeleteAccessRequest).toHaveBeenCalledWith(OUTCOME_URI, solidFetch);
    expect(onClearOutcome).toHaveBeenCalledWith(CONTAINER_A);
    expect(mockPostFileAccessRequest).toHaveBeenCalledTimes(1);
  });

  it('still re-requests when deleteAccessRequest throws', async () => {
    mockDeleteAccessRequest.mockRejectedValue(new Error('delete failed'));
    const { result } = renderHook(() => useFileAccessRequests(baseParams));
    await act(async () => { await result.current.handleRequestAgain(entryA, OUTCOME_URI); });
    expect(onClearOutcome).toHaveBeenCalledWith(CONTAINER_A);
    expect(mockPostFileAccessRequest).toHaveBeenCalledTimes(1);
  });

  it('skips the delete when re-requesting without a prior outcome notice', async () => {
    const { result } = renderHook(() => useFileAccessRequests(baseParams));
    await act(async () => { await result.current.handleRequestAgain(entryA, undefined); });
    expect(mockDeleteAccessRequest).not.toHaveBeenCalled();
    expect(onClearOutcome).toHaveBeenCalledWith(CONTAINER_A);
    expect(mockPostFileAccessRequest).toHaveBeenCalledTimes(1);
  });

  it('flags failed when the re-request itself fails', async () => {
    mockPostFileAccessRequest.mockRejectedValue(new Error('post failed'));
    const { result } = renderHook(() => useFileAccessRequests(baseParams));
    await act(async () => { await result.current.handleRequestAgain(entryA, OUTCOME_URI); });
    expect(result.current.failedUris.has(CONTAINER_A)).toBe(true);
  });
});

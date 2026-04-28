import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { CatalogEntry } from '@/types';
import type { AccessRejection } from '@/infrastructure/inbox/inboxAccess';

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
const onClearRejection = vi.fn();

const entryA: CatalogEntry = {
  uri: 'https://pod.example/app/doc1/index.ttl',
  title: 'Document 1',
  conformsTo: '',
  description: '',
  modified: '',
  publisher: '',
  mediaType: '',
  byteSize: 0,
  accessURL: '',
};

const entryB: CatalogEntry = {
  uri: 'https://pod.example/app/doc2/index.ttl',
  title: 'Document 2',
  conformsTo: '',
  description: '',
  modified: '',
  publisher: '',
  mediaType: '',
  byteSize: 0,
  accessURL: '',
};

const classUri = 'http://schema.org/ImageObject';

const baseParams = {
  contactWebId: 'https://contact.example/profile/card#me',
  viewerWebId: 'https://viewer.example/profile/card#me',
  solidFetch,
  entries: [entryA, entryB],
  classUri,
  onClearRejection,
};

describe('useFileAccessRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDiscoverInboxUri.mockResolvedValue('https://contact.example/inbox/');
    mockPostFileAccessRequest.mockResolvedValue(undefined);
    mockPostTypeAccessRequest.mockResolvedValue(undefined);
    mockDeleteAccessRequest.mockResolvedValue(undefined);
  });

  it('initialises with idle bulk status and empty file statuses', () => {
    const { result } = renderHook(() => useFileAccessRequests(baseParams));
    expect(result.current.bulkStatus).toBe('idle');
    expect(result.current.fileStatuses).toEqual({});
  });

  // --- handleRequestAll ---

  it('sets bulkStatus to "sending" while request is in flight', async () => {
    let resolveInbox!: (value: string) => void;
    mockDiscoverInboxUri.mockReturnValue(new Promise<string>((resolve) => { resolveInbox = resolve; }));

    const { result } = renderHook(() => useFileAccessRequests(baseParams));

    act(() => { void result.current.handleRequestAll(); });
    expect(result.current.bulkStatus).toBe('sending');

    await act(async () => { resolveInbox('https://contact.example/inbox/'); });
  });

  it('sets bulkStatus to "sent" after the category request succeeds', async () => {
    const { result } = renderHook(() => useFileAccessRequests(baseParams));

    await act(async () => { await result.current.handleRequestAll(); });

    expect(result.current.bulkStatus).toBe('sent');
  });

  it('sends exactly one category-level request regardless of entry count', async () => {
    const { result } = renderHook(() => useFileAccessRequests(baseParams));

    await act(async () => { await result.current.handleRequestAll(); });

    expect(mockPostTypeAccessRequest).toHaveBeenCalledTimes(1);
    expect(mockPostFileAccessRequest).not.toHaveBeenCalled();
  });

  it('passes the classUri to postTypeAccessRequest', async () => {
    const { result } = renderHook(() => useFileAccessRequests(baseParams));

    await act(async () => { await result.current.handleRequestAll(); });

    expect(mockDiscoverInboxUri).toHaveBeenCalledWith(
      'https://contact.example/profile/card#me',
      solidFetch
    );
    expect(mockPostTypeAccessRequest).toHaveBeenCalledWith(
      'https://contact.example/inbox/',
      'https://viewer.example/profile/card#me',
      classUri,
      solidFetch
    );
  });

  it('marks every entry as "sent" after a successful bulk request', async () => {
    const { result } = renderHook(() => useFileAccessRequests(baseParams));

    await act(async () => { await result.current.handleRequestAll(); });

    expect(result.current.fileStatuses[entryA.uri]).toBe('sent');
    expect(result.current.fileStatuses[entryB.uri]).toBe('sent');
  });

  it('sets bulkStatus to "error" when inbox discovery fails', async () => {
    mockDiscoverInboxUri.mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useFileAccessRequests(baseParams));

    await act(async () => { await result.current.handleRequestAll(); });

    expect(result.current.bulkStatus).toBe('error');
  });

  it('sets bulkStatus to "error" when posting the category request fails', async () => {
    mockPostTypeAccessRequest.mockRejectedValue(new Error('post failed'));
    const { result } = renderHook(() => useFileAccessRequests(baseParams));

    await act(async () => { await result.current.handleRequestAll(); });

    expect(result.current.bulkStatus).toBe('error');
  });

  // --- handleRequestFile ---

  it('sets file status to "sending" then "sent" on success', async () => {
    const { result } = renderHook(() => useFileAccessRequests(baseParams));

    await act(async () => { await result.current.handleRequestFile(entryA); });

    expect(result.current.fileStatuses[entryA.uri]).toBe('sent');
    expect(mockPostFileAccessRequest).toHaveBeenCalledTimes(1);
  });

  it('sends the correct container URI for the file', async () => {
    const { result } = renderHook(() => useFileAccessRequests(baseParams));

    await act(async () => { await result.current.handleRequestFile(entryA); });

    expect(mockPostFileAccessRequest).toHaveBeenCalledWith(
      'https://contact.example/inbox/',
      'https://viewer.example/profile/card#me',
      'https://pod.example/app/doc1/',
      solidFetch
    );
  });

  it('sets file status to "error" when the request fails', async () => {
    mockDiscoverInboxUri.mockRejectedValue(new Error('inbox error'));
    const { result } = renderHook(() => useFileAccessRequests(baseParams));

    await act(async () => { await result.current.handleRequestFile(entryA); });

    expect(result.current.fileStatuses[entryA.uri]).toBe('error');
  });

  it('tracks statuses independently for different files', async () => {
    mockDiscoverInboxUri
      .mockResolvedValueOnce('https://contact.example/inbox/')
      .mockRejectedValueOnce(new Error('fail'));

    const { result } = renderHook(() => useFileAccessRequests(baseParams));

    await act(async () => { await result.current.handleRequestFile(entryA); });
    await act(async () => { await result.current.handleRequestFile(entryB); });

    expect(result.current.fileStatuses[entryA.uri]).toBe('sent');
    expect(result.current.fileStatuses[entryB.uri]).toBe('error');
  });

  // --- handleRequestAgain ---

  const rejection: AccessRejection = {
    accessTo: 'https://pod.example/app/doc1/',
    messageUri: 'https://viewer.example/inbox/rejection1',
  };

  it('deletes the old rejection message before re-requesting', async () => {
    const { result } = renderHook(() => useFileAccessRequests(baseParams));

    await act(async () => { await result.current.handleRequestAgain(entryA, rejection); });

    expect(mockDeleteAccessRequest).toHaveBeenCalledWith(
      'https://viewer.example/inbox/rejection1',
      solidFetch
    );
  });

  it('calls onClearRejection with the container URI', async () => {
    const { result } = renderHook(() => useFileAccessRequests(baseParams));

    await act(async () => { await result.current.handleRequestAgain(entryA, rejection); });

    expect(onClearRejection).toHaveBeenCalledWith('https://pod.example/app/doc1/');
  });

  it('sends a new access request after clearing the rejection', async () => {
    const { result } = renderHook(() => useFileAccessRequests(baseParams));

    await act(async () => { await result.current.handleRequestAgain(entryA, rejection); });

    expect(mockPostFileAccessRequest).toHaveBeenCalledTimes(1);
    expect(result.current.fileStatuses[entryA.uri]).toBe('sent');
  });

  it('still clears and re-requests even when deleteAccessRequest throws', async () => {
    mockDeleteAccessRequest.mockRejectedValue(new Error('delete failed'));
    const { result } = renderHook(() => useFileAccessRequests(baseParams));

    await act(async () => { await result.current.handleRequestAgain(entryA, rejection); });

    expect(onClearRejection).toHaveBeenCalledWith('https://pod.example/app/doc1/');
    expect(mockPostFileAccessRequest).toHaveBeenCalledTimes(1);
  });

  it('sets file status to "error" when the re-request fails after clearing', async () => {
    mockPostFileAccessRequest.mockRejectedValue(new Error('post failed'));
    const { result } = renderHook(() => useFileAccessRequests(baseParams));

    await act(async () => { await result.current.handleRequestAgain(entryA, rejection); });

    expect(result.current.fileStatuses[entryA.uri]).toBe('error');
  });
});

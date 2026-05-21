import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockFetch = vi.fn();
const mockDiscoverInboxUri = vi.fn();
const mockListAccessRequests = vi.fn();
const mockDeleteAccessRequest = vi.fn();
const mockPostRejectionNotification = vi.fn();
const mockDiscoverAclUri = vi.fn();
const mockWriteResourceAcl = vi.fn();
const mockGrantContainerReadAccess = vi.fn();
const mockEnsureDiscoveryAccess = vi.fn();

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ fetch: mockFetch }),
}));

vi.mock('@/infrastructure/inbox/inboxAccess', () => ({
  discoverInboxUri: (...args: unknown[]) => mockDiscoverInboxUri(...args),
  listAccessRequests: (...args: unknown[]) => mockListAccessRequests(...args),
  deleteAccessRequest: (...args: unknown[]) => mockDeleteAccessRequest(...args),
  postRejectionNotification: (...args: unknown[]) => mockPostRejectionNotification(...args),
}));

vi.mock('@/infrastructure/wac/aclManager', () => ({
  discoverAclUri: (...args: unknown[]) => mockDiscoverAclUri(...args),
  writeResourceAcl: (...args: unknown[]) => mockWriteResourceAcl(...args),
  grantContainerReadAccess: (...args: unknown[]) => mockGrantContainerReadAccess(...args),
  ensureDiscoveryAccess: (...args: unknown[]) => mockEnsureDiscoveryAccess(...args),
}));

vi.mock('@/infrastructure/solid/sharedCatalog', () => ({
  getAppContainerUri: (root: string) => `${root}my-solid-app/`,
  getSharedCatalogUri: (appUri: string, webId: string) => `${appUri}.shared-${encodeURIComponent(webId)}.ttl`,
  toContainerUri: (uri: string) =>
    uri.endsWith('/') ? uri : uri.slice(0, uri.lastIndexOf('/') + 1),
}));

const mockParseCatalog = vi.fn();
vi.mock('@/infrastructure/solid/catalog', () => ({
  EMPTY_CATALOG_TURTLE: '@prefix dcat: <http://www.w3.org/ns/dcat#>.',
  parseCatalog: (...args: unknown[]) => mockParseCatalog(...args),
}));

vi.mock('@/config', () => ({
  CONTENT_TYPES: { TURTLE: 'text/turtle' },
}));

import { useAccessRequests } from '../useAccessRequests-file/useAccessRequests';

const ownerWebId = 'https://pod.example/profile/card#me';
const storageRoot = 'https://pod.example/';
const catalogUri = 'https://pod.example/my-solid-app/catalog.ttl';

describe('useAccessRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDiscoverInboxUri.mockResolvedValue('https://pod.example/inbox/');
    mockListAccessRequests.mockResolvedValue([]);
    mockDeleteAccessRequest.mockResolvedValue(undefined);
    mockPostRejectionNotification.mockResolvedValue(undefined);
    mockDiscoverAclUri.mockResolvedValue('https://pod.example/.acl');
    mockWriteResourceAcl.mockResolvedValue(undefined);
    mockGrantContainerReadAccess.mockResolvedValue(undefined);
    mockEnsureDiscoveryAccess.mockResolvedValue(undefined);
    mockParseCatalog.mockReturnValue([]);
    mockFetch.mockResolvedValue({ ok: true });
  });

  it('fetches access requests from inbox on mount and exposes them via requests array', async () => {
    const requests = [
      { messageUri: 'https://pod.example/inbox/msg1', requesterWebId: 'https://alice.example/profile/card#me', requestType: 'catalog', accessTo: '' },
    ];
    mockListAccessRequests.mockResolvedValue(requests);

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.requests).toEqual(requests);
    expect(result.current.error).toBeNull();
  });

  it('sets error when loadRequests fails', async () => {
    mockDiscoverInboxUri.mockRejectedValue(new Error('Inbox not found'));

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe('Inbox not found');
  });

  it('approve handles catalog request type', async () => {
    const request = {
      messageUri: 'https://pod.example/inbox/msg1',
      requesterWebId: 'https://alice.example/profile/card#me',
      requestType: 'catalog' as const,
      accessTo: 'https://pod.example/files/',
      timestamp: '',
    };
    mockListAccessRequests.mockResolvedValue([request]);
    mockFetch.mockResolvedValue({ ok: false }); // ensureEmptySharedCatalog HEAD check fails

    mockFetch.mockImplementation(async (_url: string, opts?: Record<string, unknown>) => {
      if (opts?.method === 'HEAD') return { ok: false };
      if (opts?.method === 'PUT') return { ok: true };
      return { ok: true };
    });

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.approve(request);
    });

    expect(mockDeleteAccessRequest).toHaveBeenCalledWith(request.messageUri, mockFetch);
    expect(result.current.requests).toEqual([]);
  });

  it('approve handles file request type', async () => {
    const request = {
      messageUri: 'https://pod.example/inbox/msg2',
      requesterWebId: 'https://alice.example/profile/card#me',
      requestType: 'file' as const,
      accessTo: 'https://pod.example/files/doc/',
      timestamp: '',
    };
    mockListAccessRequests.mockResolvedValue([request]);

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.approve(request);
    });

    expect(mockGrantContainerReadAccess).toHaveBeenCalledWith(
      request.accessTo,
      ownerWebId,
      request.requesterWebId,
      mockFetch
    );
    expect(mockDeleteAccessRequest).toHaveBeenCalled();
  });

  it('approve(file) also grants discovery access to the main catalog so the requester can browse other items', async () => {
    const request = {
      messageUri: 'https://pod.example/inbox/msg-file-disco',
      requesterWebId: 'https://alice.example/profile/card#me',
      requestType: 'file' as const,
      accessTo: 'https://pod.example/files/doc/',
      timestamp: '',
    };
    mockListAccessRequests.mockResolvedValue([request]);

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.approve(request); });

    expect(mockEnsureDiscoveryAccess).toHaveBeenCalledWith(
      catalogUri,
      'https://pod.example/my-solid-app/',
      ownerWebId,
      request.requesterWebId,
      mockFetch
    );
  });

  it('deny deletes request and posts rejection notification', async () => {
    const request = {
      messageUri: 'https://pod.example/inbox/msg3',
      requesterWebId: 'https://alice.example/profile/card#me',
      requestType: 'catalog' as const,
      accessTo: 'https://pod.example/files/',
      timestamp: '',
    };
    mockListAccessRequests.mockResolvedValue([request]);

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deny(request);
    });

    expect(mockPostRejectionNotification).toHaveBeenCalled();
    expect(mockDeleteAccessRequest).toHaveBeenCalledWith(request.messageUri, mockFetch);
    expect(result.current.requests).toEqual([]);
  });

  it('deny still removes the request even when rejection notification fails to send', async () => {
    const request = {
      messageUri: 'https://pod.example/inbox/msg4',
      requesterWebId: 'https://alice.example/profile/card#me',
      requestType: 'catalog' as const,
      accessTo: 'https://pod.example/files/',
      timestamp: '',
    };
    mockListAccessRequests.mockResolvedValue([request]);
    mockDiscoverInboxUri.mockImplementation(async (webId: string) => {
      if (webId === request.requesterWebId) throw new Error('No inbox');
      return 'https://pod.example/inbox/';
    });

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deny(request);
    });

    expect(mockDeleteAccessRequest).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('sets error when approve fails', async () => {
    const request = {
      messageUri: 'https://pod.example/inbox/msg5',
      requesterWebId: 'https://alice.example/profile/card#me',
      requestType: 'file' as const,
      accessTo: 'https://pod.example/files/',
      timestamp: '',
    };
    mockListAccessRequests.mockResolvedValue([request]);
    mockGrantContainerReadAccess.mockRejectedValue(new Error('ACL error'));

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.approve(request);
    });

    expect(result.current.error).toBe('ACL error');
    expect(result.current.busyMessageUri).toBeNull();
  });

  // --- Branch coverage additions ---

  it('skips creating shared catalog file when it already exists on the server', async () => {
    const request = {
      messageUri: 'https://pod.example/inbox/msg6',
      requesterWebId: 'https://alice.example/profile/card#me',
      requestType: 'catalog' as const,
      accessTo: 'https://pod.example/files/',
      timestamp: '',
    };
    mockListAccessRequests.mockResolvedValue([request]);
    // HEAD returns ok → ensureEmptySharedCatalog should return immediately without PUT
    mockFetch.mockImplementation(async (_url: string, opts?: Record<string, unknown>) => {
      if (opts?.method === 'HEAD') return { ok: true };
      if (opts?.method === 'PUT') throw new Error('PUT should not be called');
      return { ok: true };
    });

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.approve(request);
    });

    expect(mockDeleteAccessRequest).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('sets error when shared catalog file creation fails on the server', async () => {
    const request = {
      messageUri: 'https://pod.example/inbox/msg7',
      requesterWebId: 'https://alice.example/profile/card#me',
      requestType: 'catalog' as const,
      accessTo: 'https://pod.example/files/',
      timestamp: '',
    };
    mockListAccessRequests.mockResolvedValue([request]);
    mockFetch.mockImplementation(async (_url: string, opts?: Record<string, unknown>) => {
      if (opts?.method === 'HEAD') return { ok: false };
      if (opts?.method === 'PUT') return { ok: false, status: 403, statusText: 'Forbidden' };
      return { ok: true };
    });

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.approve(request);
    });

    expect(result.current.error).toContain('Failed to create shared catalog');
  });

  it('deny handles non-Error thrown in catch with String(err)', async () => {
    const request = {
      messageUri: 'https://pod.example/inbox/msg8',
      requesterWebId: 'https://alice.example/profile/card#me',
      requestType: 'catalog' as const,
      accessTo: 'https://pod.example/files/',
      timestamp: '',
    };
    mockListAccessRequests.mockResolvedValue([request]);
    // deleteAccessRequest throws a non-Error value
    mockDeleteAccessRequest.mockRejectedValue('string error');

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deny(request);
    });

    expect(result.current.error).toBe('string error');
    expect(result.current.busyMessageUri).toBeNull();
  });

  it('loadRequests handles non-Error thrown with String(err)', async () => {
    mockDiscoverInboxUri.mockRejectedValue(42);

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe('42');
  });

  it('approve handles non-Error thrown by converting to string via String(err)', async () => {
    const request = {
      messageUri: 'https://pod.example/inbox/msg11',
      requesterWebId: 'https://alice.example/profile/card#me',
      requestType: 'file' as const,
      accessTo: 'https://pod.example/files/doc/',
      timestamp: '',
    };
    mockListAccessRequests.mockResolvedValue([request]);
    mockGrantContainerReadAccess.mockRejectedValue(99);

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.approve(request);
    });

    expect(result.current.error).toBe('99');
    expect(result.current.busyMessageUri).toBeNull();
  });

  // --- approve(type) snapshot grant ---

  const imageClass = 'http://schema.org/ImageObject';
  const docClass = 'http://schema.org/DigitalDocument';

  function makeTypeRequest() {
    return {
      messageUri: 'https://pod.example/inbox/msg-type',
      requesterWebId: 'https://alice.example/profile/card#me',
      requestType: 'type' as const,
      forClass: imageClass,
      accessTo: '',
      timestamp: '',
    };
  }

  it('approve(type) grants access to every container whose conformsTo matches forClass', async () => {
    const request = makeTypeRequest();
    mockListAccessRequests.mockResolvedValue([request]);
    mockFetch.mockImplementation(async (url: string) => {
      if (url === catalogUri) {
        return { ok: true, status: 200, text: async () => 'CATALOG_TTL' };
      }
      return { ok: true };
    });
    mockParseCatalog.mockReturnValue([
      { uri: 'https://pod.example/my-solid-app/img1/index.ttl', conformsTo: imageClass },
      { uri: 'https://pod.example/my-solid-app/img2/index.ttl', conformsTo: imageClass },
      { uri: 'https://pod.example/my-solid-app/doc1/index.ttl', conformsTo: docClass },
    ]);

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.approve(request); });

    expect(mockGrantContainerReadAccess).toHaveBeenCalledTimes(2);
    const calledContainers = mockGrantContainerReadAccess.mock.calls.map((call) => call[0]);
    expect(calledContainers).toEqual([
      'https://pod.example/my-solid-app/img1/',
      'https://pod.example/my-solid-app/img2/',
    ]);
    expect(mockDeleteAccessRequest).toHaveBeenCalledWith(request.messageUri, mockFetch);
    expect(result.current.requests).toEqual([]);
  });

  it('approve(type) also grants discovery access to the main catalog and app container', async () => {
    const request = makeTypeRequest();
    mockListAccessRequests.mockResolvedValue([request]);
    mockFetch.mockImplementation(async (url: string) => {
      if (url === catalogUri) return { ok: true, status: 200, text: async () => 'CATALOG_TTL' };
      return { ok: true };
    });
    mockParseCatalog.mockReturnValue([
      { uri: 'https://pod.example/my-solid-app/img1/index.ttl', conformsTo: imageClass },
    ]);

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.approve(request); });

    expect(mockEnsureDiscoveryAccess).toHaveBeenCalledWith(
      catalogUri,
      'https://pod.example/my-solid-app/',
      ownerWebId,
      request.requesterWebId,
      mockFetch
    );
  });

  it('approve(type) skips containers that fail and still grants the rest', async () => {
    const request = makeTypeRequest();
    mockListAccessRequests.mockResolvedValue([request]);
    mockFetch.mockImplementation(async (url: string) => {
      if (url === catalogUri) return { ok: true, status: 200, text: async () => 'CATALOG_TTL' };
      return { ok: true };
    });
    mockParseCatalog.mockReturnValue([
      { uri: 'https://pod.example/my-solid-app/img-stale/index.ttl', conformsTo: imageClass },
      { uri: 'https://pod.example/my-solid-app/img-live/index.ttl', conformsTo: imageClass },
    ]);
    mockGrantContainerReadAccess.mockImplementation(async (containerUri: string) => {
      if (containerUri.includes('img-stale')) {
        throw new Error(`HEAD ${containerUri} returned 404 Not Found`);
      }
    });

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.approve(request); });

    const successfulCalls = mockGrantContainerReadAccess.mock.calls
      .map((call) => call[0])
      .filter((containerUri: string) => containerUri.includes('img-live'));
    expect(successfulCalls).toEqual(['https://pod.example/my-solid-app/img-live/']);
    expect(mockDeleteAccessRequest).toHaveBeenCalledWith(request.messageUri, mockFetch);
    expect(result.current.requests).toEqual([]);
  });

  it('approve(type) fails when every matching container is unreachable', async () => {
    const request = makeTypeRequest();
    mockListAccessRequests.mockResolvedValue([request]);
    mockFetch.mockImplementation(async (url: string) => {
      if (url === catalogUri) return { ok: true, status: 200, text: async () => 'CATALOG_TTL' };
      return { ok: true };
    });
    mockParseCatalog.mockReturnValue([
      { uri: 'https://pod.example/my-solid-app/img1/index.ttl', conformsTo: imageClass },
      { uri: 'https://pod.example/my-solid-app/img2/index.ttl', conformsTo: imageClass },
    ]);
    mockGrantContainerReadAccess.mockRejectedValue(new Error('HEAD returned 404'));

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.approve(request); });

    expect(mockDeleteAccessRequest).not.toHaveBeenCalled();
    expect(result.current.requests).toHaveLength(1);
    expect(result.current.error).toContain('404');
  });

  it('approve(type) sets error when the catalog GET fails', async () => {
    const request = makeTypeRequest();
    mockListAccessRequests.mockResolvedValue([request]);
    mockFetch.mockImplementation(async (url: string) => {
      if (url === catalogUri) return { ok: false, status: 403, statusText: 'Forbidden' };
      return { ok: true };
    });

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.approve(request); });

    expect(mockGrantContainerReadAccess).not.toHaveBeenCalled();
    expect(result.current.error).toBeTruthy();
  });

  it('deny sets error with err.message when an Error instance is thrown', async () => {
    const request = {
      messageUri: 'https://pod.example/inbox/msg12',
      requesterWebId: 'https://alice.example/profile/card#me',
      requestType: 'catalog' as const,
      accessTo: 'https://pod.example/files/',
      timestamp: '',
    };
    mockListAccessRequests.mockResolvedValue([request]);
    mockDeleteAccessRequest.mockRejectedValue(new Error('Delete failed'));

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deny(request);
    });

    expect(result.current.error).toBe('Delete failed');
    expect(result.current.busyMessageUri).toBeNull();
  });

  it('dedupes active requests with the same requester + target', async () => {
    const earlier = {
      messageUri: 'https://pod.example/inbox/msg-old',
      requesterWebId: 'https://peach.example/profile/card#me',
      requestType: 'catalog' as const,
      accessTo: '',
      timestamp: '2026-05-20T08:00:00Z',
    };
    const later = {
      messageUri: 'https://pod.example/inbox/msg-new',
      requesterWebId: 'https://peach.example/profile/card#me',
      requestType: 'catalog' as const,
      accessTo: '',
      timestamp: '2026-05-20T10:00:00Z',
    };
    mockListAccessRequests.mockResolvedValue([later, earlier]);

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.requests).toHaveLength(1);
    expect(result.current.requests[0].messageUri).toBe('https://pod.example/inbox/msg-old');
  });

  it('keeps requests separate when target or type differs', async () => {
    const catalogRequest = {
      messageUri: 'urn:msg:catalog',
      requesterWebId: 'https://peach.example/profile/card#me',
      requestType: 'catalog' as const,
      accessTo: '',
      timestamp: '2026-05-20T08:00:00Z',
    };
    const fileRequest = {
      messageUri: 'urn:msg:file',
      requesterWebId: 'https://peach.example/profile/card#me',
      requestType: 'file' as const,
      accessTo: 'https://pod.example/files/x/',
      timestamp: '2026-05-20T08:00:00Z',
    };
    mockListAccessRequests.mockResolvedValue([catalogRequest, fileRequest]);

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.requests).toHaveLength(2);
  });

  it('approve deletes every duplicate message for the same request', async () => {
    const requests = [
      {
        messageUri: 'urn:msg:1',
        requesterWebId: 'https://peach.example/profile/card#me',
        requestType: 'catalog' as const,
        accessTo: '',
        timestamp: '2026-05-20T08:00:00Z',
      },
      {
        messageUri: 'urn:msg:2',
        requesterWebId: 'https://peach.example/profile/card#me',
        requestType: 'catalog' as const,
        accessTo: '',
        timestamp: '2026-05-20T09:00:00Z',
      },
      {
        messageUri: 'urn:msg:3',
        requesterWebId: 'https://peach.example/profile/card#me',
        requestType: 'catalog' as const,
        accessTo: '',
        timestamp: '2026-05-20T10:00:00Z',
      },
    ];
    mockListAccessRequests.mockResolvedValue(requests);

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.approve(result.current.requests[0]);
    });

    expect(mockDeleteAccessRequest).toHaveBeenCalledTimes(3);
    expect(mockDeleteAccessRequest).toHaveBeenCalledWith('urn:msg:1', expect.anything());
    expect(mockDeleteAccessRequest).toHaveBeenCalledWith('urn:msg:2', expect.anything());
    expect(mockDeleteAccessRequest).toHaveBeenCalledWith('urn:msg:3', expect.anything());
    expect(result.current.requests).toHaveLength(0);
  });

  it('deny deletes every duplicate message for the same request', async () => {
    const requests = [
      {
        messageUri: 'urn:msg:a',
        requesterWebId: 'https://peach.example/profile/card#me',
        requestType: 'catalog' as const,
        accessTo: '',
        timestamp: '2026-05-20T08:00:00Z',
      },
      {
        messageUri: 'urn:msg:b',
        requesterWebId: 'https://peach.example/profile/card#me',
        requestType: 'catalog' as const,
        accessTo: '',
        timestamp: '2026-05-20T09:00:00Z',
      },
    ];
    mockListAccessRequests.mockResolvedValue(requests);

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deny(result.current.requests[0]);
    });

    expect(mockDeleteAccessRequest).toHaveBeenCalledTimes(2);
    expect(result.current.requests).toHaveLength(0);
  });
});

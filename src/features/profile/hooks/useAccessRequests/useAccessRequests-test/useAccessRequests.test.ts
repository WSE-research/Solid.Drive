import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockFetch = vi.fn();
const mockDiscoverInboxUri = vi.fn();
const mockListAccessRequests = vi.fn();
const mockDeleteAccessRequest = vi.fn();
const mockPostRejectionNotification = vi.fn();
const mockDiscoverAclUri = vi.fn();
const mockReadAclAgents = vi.fn();
const mockWriteResourceAcl = vi.fn();
const mockWriteListOnlyAcl = vi.fn();
const mockWriteAcl = vi.fn();

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ fetch: mockFetch }),
}));

vi.mock('@/infrastructure/inbox/inboxAccess', () => ({
  discoverInboxUri: (...args: any[]) => mockDiscoverInboxUri(...args),
  listAccessRequests: (...args: any[]) => mockListAccessRequests(...args),
  deleteAccessRequest: (...args: any[]) => mockDeleteAccessRequest(...args),
  postRejectionNotification: (...args: any[]) => mockPostRejectionNotification(...args),
}));

vi.mock('@/infrastructure/wac/aclManager', () => ({
  discoverAclUri: (...args: any[]) => mockDiscoverAclUri(...args),
  readAclAgents: (...args: any[]) => mockReadAclAgents(...args),
  writeResourceAcl: (...args: any[]) => mockWriteResourceAcl(...args),
  writeListOnlyAcl: (...args: any[]) => mockWriteListOnlyAcl(...args),
  writeAcl: (...args: any[]) => mockWriteAcl(...args),
}));

vi.mock('@/infrastructure/solid/sharedCatalog', () => ({
  getAppContainerUri: (root: string) => `${root}my-solid-app/`,
  getSharedCatalogUri: (appUri: string, webId: string) => `${appUri}.shared-${encodeURIComponent(webId)}.ttl`,
}));

vi.mock('@/infrastructure/solid/catalog', () => ({
  EMPTY_CATALOG_TURTLE: '@prefix dcat: <http://www.w3.org/ns/dcat#>.',
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
    mockReadAclAgents.mockResolvedValue([]);
    mockWriteResourceAcl.mockResolvedValue(undefined);
    mockWriteListOnlyAcl.mockResolvedValue(undefined);
    mockWriteAcl.mockResolvedValue(undefined);
    mockFetch.mockResolvedValue({ ok: true });
  });

  it('is defined', () => {
    expect(useAccessRequests).toBeDefined();
  });

  it('loads requests on mount', async () => {
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
    };
    mockListAccessRequests.mockResolvedValue([request]);
    mockFetch.mockResolvedValue({ ok: false }); // ensureEmptySharedCatalog HEAD check fails

    const putFetch = vi.fn().mockResolvedValue({ ok: true });
    mockFetch.mockImplementation(async (url: string, opts?: any) => {
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
    };
    mockListAccessRequests.mockResolvedValue([request]);

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.approve(request);
    });

    expect(mockWriteAcl).toHaveBeenCalled();
    expect(mockDeleteAccessRequest).toHaveBeenCalled();
  });

  it('deny deletes request and posts rejection notification', async () => {
    const request = {
      messageUri: 'https://pod.example/inbox/msg3',
      requesterWebId: 'https://alice.example/profile/card#me',
      requestType: 'catalog' as const,
      accessTo: 'https://pod.example/files/',
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

  it('deny handles notification failure gracefully', async () => {
    const request = {
      messageUri: 'https://pod.example/inbox/msg4',
      requesterWebId: 'https://alice.example/profile/card#me',
      requestType: 'catalog' as const,
      accessTo: 'https://pod.example/files/',
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
    };
    mockListAccessRequests.mockResolvedValue([request]);
    mockDiscoverAclUri.mockRejectedValue(new Error('ACL error'));

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Reset mock for approve flow
    mockDiscoverAclUri.mockRejectedValue(new Error('ACL error'));
    await act(async () => {
      await result.current.approve(request);
    });

    expect(result.current.error).toBe('ACL error');
    expect(result.current.busyMessageUri).toBeNull();
  });

  // --- Branch coverage additions ---

  it('ensureEmptySharedCatalog HEAD ok → skips PUT', async () => {
    const request = {
      messageUri: 'https://pod.example/inbox/msg6',
      requesterWebId: 'https://alice.example/profile/card#me',
      requestType: 'catalog' as const,
      accessTo: 'https://pod.example/files/',
    };
    mockListAccessRequests.mockResolvedValue([request]);
    // HEAD returns ok → ensureEmptySharedCatalog should return immediately without PUT
    mockFetch.mockImplementation(async (_url: string, opts?: any) => {
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

  it('ensureEmptySharedCatalog PUT failure throws error', async () => {
    const request = {
      messageUri: 'https://pod.example/inbox/msg7',
      requesterWebId: 'https://alice.example/profile/card#me',
      requestType: 'catalog' as const,
      accessTo: 'https://pod.example/files/',
    };
    mockListAccessRequests.mockResolvedValue([request]);
    mockFetch.mockImplementation(async (_url: string, opts?: any) => {
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

  it('approve skips writing catalog ACL when requester already exists in agents', async () => {
    const request = {
      messageUri: 'https://pod.example/inbox/msg9',
      requesterWebId: 'https://alice.example/profile/card#me',
      requestType: 'catalog' as const,
      accessTo: 'https://pod.example/files/',
    };
    mockListAccessRequests.mockResolvedValue([request]);
    mockFetch.mockImplementation(async (_url: string, opts?: any) => {
      if (opts?.method === 'HEAD') return { ok: false };
      if (opts?.method === 'PUT') return { ok: true };
      return { ok: true };
    });
    // Return agent already in list for both catalog and app ACLs
    mockReadAclAgents.mockResolvedValue(['https://alice.example/profile/card#me']);

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.approve(request);
    });

    // writeResourceAcl should only be called once (for shared catalog), not for catalog/app since agent already exists
    expect(mockWriteResourceAcl).toHaveBeenCalledTimes(1);
    expect(mockWriteListOnlyAcl).not.toHaveBeenCalled();
    expect(mockDeleteAccessRequest).toHaveBeenCalled();
  });

  it('approve skips writing file ACL when requester already exists', async () => {
    const request = {
      messageUri: 'https://pod.example/inbox/msg10',
      requesterWebId: 'https://alice.example/profile/card#me',
      requestType: 'file' as const,
      accessTo: 'https://pod.example/files/doc/',
    };
    mockListAccessRequests.mockResolvedValue([request]);
    mockReadAclAgents.mockResolvedValue(['https://alice.example/profile/card#me']);

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.approve(request);
    });

    expect(mockWriteAcl).not.toHaveBeenCalled();
    expect(mockDeleteAccessRequest).toHaveBeenCalled();
  });

  it('approve handles non-Error thrown with String(err) (line 110)', async () => {
    const request = {
      messageUri: 'https://pod.example/inbox/msg11',
      requesterWebId: 'https://alice.example/profile/card#me',
      requestType: 'file' as const,
      accessTo: 'https://pod.example/files/doc/',
    };
    mockListAccessRequests.mockResolvedValue([request]);
    mockDiscoverAclUri.mockRejectedValue(99);

    const { result } = renderHook(() => useAccessRequests(ownerWebId, storageRoot, catalogUri));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.approve(request);
    });

    expect(result.current.error).toBe('99');
    expect(result.current.busyMessageUri).toBeNull();
  });

  it('deny sets error with err.message when Error is thrown (line 129)', async () => {
    const request = {
      messageUri: 'https://pod.example/inbox/msg12',
      requesterWebId: 'https://alice.example/profile/card#me',
      requestType: 'catalog' as const,
      accessTo: 'https://pod.example/files/',
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
});

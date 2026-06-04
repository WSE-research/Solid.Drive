import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const mockDiscoverInbox = vi.fn();
const mockPostRequest = vi.fn();
const mockDeleteRequest = vi.fn();

vi.mock('@/infrastructure/inbox/inboxAccess', () => ({
  discoverInboxUri: (...args: unknown[]) => mockDiscoverInbox(...args),
  postCatalogAccessRequest: (...args: unknown[]) => mockPostRequest(...args),
  deleteAccessRequest: (...args: unknown[]) => mockDeleteRequest(...args),
}));

const mockMarkPending = vi.fn();
const mockClearPending = vi.fn();
vi.mock('@/shared/hooks/usePendingRequests', () => ({
  usePendingRequests: () => ({
    isPending: () => false,
    markPending: mockMarkPending,
    clearPending: mockClearPending,
  }),
}));

import { useContactRequest } from '../useContactRequest-file/useContactRequest';

const baseArgs = {
  webId: 'https://contact.example/profile/card#me',
  ownerWebId: 'https://owner.example/profile/card#me',
  solidFetch: vi.fn() as unknown as (url: RequestInfo, init?: RequestInit) => Promise<Response>,
  outcomeMessageUri: undefined as string | undefined,
  onClearOutcome: vi.fn(),
};

describe('useContactRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDiscoverInbox.mockResolvedValue('https://contact.example/inbox/');
    mockPostRequest.mockResolvedValue(undefined);
    mockDeleteRequest.mockResolvedValue(undefined);
  });

  it('starts not failed', () => {
    const { result } = renderHook(() => useContactRequest(baseArgs));
    expect(result.current.failed).toBe(false);
  });

  it('marks the contact pending and posts the request', async () => {
    const { result } = renderHook(() => useContactRequest(baseArgs));
    await act(async () => {
      await result.current.request();
    });
    expect(mockMarkPending).toHaveBeenCalledWith(baseArgs.webId);
    expect(mockDiscoverInbox).toHaveBeenCalledWith(baseArgs.webId, baseArgs.solidFetch);
    expect(mockPostRequest).toHaveBeenCalled();
    expect(result.current.failed).toBe(false);
  });

  it('rolls back the pending flag and flags failed when discovery throws', async () => {
    mockDiscoverInbox.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useContactRequest(baseArgs));
    await act(async () => {
      await result.current.request();
    });
    expect(mockClearPending).toHaveBeenCalledWith(baseArgs.webId);
    expect(result.current.failed).toBe(true);
  });

  it('flags failed when the post rejects', async () => {
    mockPostRequest.mockRejectedValueOnce(new Error('rejected'));
    const { result } = renderHook(() => useContactRequest(baseArgs));
    await act(async () => {
      await result.current.request();
    });
    expect(result.current.failed).toBe(true);
  });

  it('requestAgain deletes the prior outcome notice, clears it, and re-posts', async () => {
    const onClearOutcome = vi.fn();
    const outcomeMessageUri = 'https://owner.example/inbox/msg-1';
    const { result } = renderHook(() => useContactRequest({ ...baseArgs, outcomeMessageUri, onClearOutcome }));
    await act(async () => {
      await result.current.requestAgain();
    });
    expect(mockDeleteRequest).toHaveBeenCalledWith(outcomeMessageUri, baseArgs.solidFetch);
    expect(onClearOutcome).toHaveBeenCalled();
    expect(mockMarkPending).toHaveBeenCalledWith(baseArgs.webId);
    expect(mockPostRequest).toHaveBeenCalled();
  });

  it('requestAgain swallows delete errors and still re-posts', async () => {
    mockDeleteRequest.mockRejectedValueOnce(new Error('cleanup failed'));
    const onClearOutcome = vi.fn();
    const { result } = renderHook(() =>
      useContactRequest({ ...baseArgs, outcomeMessageUri: 'https://x/m', onClearOutcome }),
    );
    await act(async () => {
      await result.current.requestAgain();
    });
    expect(onClearOutcome).toHaveBeenCalled();
    expect(mockPostRequest).toHaveBeenCalled();
  });
});

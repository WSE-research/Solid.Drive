import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const mockDiscoverInbox = vi.fn();
const mockPostRequest = vi.fn();
const mockDeleteRequest = vi.fn();

vi.mock('@/infrastructure/inbox/inboxAccess', () => ({
  discoverInboxUri: (...args: unknown[]) => mockDiscoverInbox(...args),
  postCatalogAccessRequest: (...args: unknown[]) => mockPostRequest(...args),
  deleteAccessRequest: (...args: unknown[]) => mockDeleteRequest(...args),
}));

import { useContactRequest } from '../useContactRequest-file/useContactRequest';

const baseArgs = {
  webId: 'https://contact.example/profile/card#me',
  ownerWebId: 'https://owner.example/profile/card#me',
  solidFetch: vi.fn() as unknown as (
    url: RequestInfo,
    init?: RequestInit,
  ) => Promise<Response>,
  rejection: undefined,
  onClearRejection: vi.fn(),
};

describe('useContactRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDiscoverInbox.mockResolvedValue('https://contact.example/inbox/');
    mockPostRequest.mockResolvedValue(undefined);
    mockDeleteRequest.mockResolvedValue(undefined);
  });

  it('starts in the idle status', () => {
    const { result } = renderHook(() => useContactRequest(baseArgs));
    expect(result.current.status).toBe('idle');
  });

  it('transitions through sending → sent on a successful request', async () => {
    const { result } = renderHook(() => useContactRequest(baseArgs));
    await act(async () => {
      await result.current.requestAccess();
    });
    expect(mockDiscoverInbox).toHaveBeenCalledWith(
      baseArgs.webId,
      baseArgs.solidFetch,
    );
    expect(mockPostRequest).toHaveBeenCalled();
    expect(result.current.status).toBe('sent');
  });

  it('transitions to error when the inbox discovery throws', async () => {
    mockDiscoverInbox.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useContactRequest(baseArgs));
    await act(async () => {
      await result.current.requestAccess();
    });
    expect(result.current.status).toBe('error');
  });

  it('transitions to error when the post request rejects', async () => {
    mockPostRequest.mockRejectedValueOnce(new Error('rejected'));
    const { result } = renderHook(() => useContactRequest(baseArgs));
    await act(async () => {
      await result.current.requestAccess();
    });
    expect(result.current.status).toBe('error');
  });

  it('requestAgain clears the rejection, deletes the message, and re-posts', async () => {
    const onClearRejection = vi.fn();
    const rejection = {
      messageUri: 'https://owner.example/inbox/msg-1',
      accessTo: baseArgs.webId,
    } as const;
    const { result } = renderHook(() =>
      useContactRequest({
        ...baseArgs,
        rejection,
        onClearRejection,
      }),
    );
    await act(async () => {
      await result.current.requestAgain();
    });
    expect(mockDeleteRequest).toHaveBeenCalledWith(
      rejection.messageUri,
      baseArgs.solidFetch,
    );
    expect(onClearRejection).toHaveBeenCalled();
    await waitFor(() => expect(result.current.status).toBe('sent'));
  });

  it('requestAgain swallows delete errors and still re-posts', async () => {
    mockDeleteRequest.mockRejectedValueOnce(new Error('cleanup failed'));
    const onClearRejection = vi.fn();
    const { result } = renderHook(() =>
      useContactRequest({
        ...baseArgs,
        rejection: { messageUri: 'https://x/m', accessTo: baseArgs.webId },
        onClearRejection,
      }),
    );
    await act(async () => {
      await result.current.requestAgain();
    });
    expect(onClearRejection).toHaveBeenCalled();
    expect(mockPostRequest).toHaveBeenCalled();
  });
});

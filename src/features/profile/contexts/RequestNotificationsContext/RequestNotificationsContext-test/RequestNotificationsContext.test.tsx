import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useEffect } from 'react';
import type { AccessRequest } from '@/infrastructure/inbox/inboxAccess';

const mockShowInfo = vi.fn();
const mockUseAccessRequests = vi.fn();

const mockSolidFetch = vi.fn();

vi.mock('@ldo/solid-react', () => ({
  useResource: () => ({ isLoading: () => false }),
  useSubject: () => undefined,
  useSolidAuth: () => ({ fetch: mockSolidFetch }),
}));

const mockSubscribeToInbox = vi.fn();
const mockDiscoverInboxUri = vi.fn();

vi.mock('@/infrastructure/inbox/inboxAccess', () => ({
  discoverInboxUri: (...args: unknown[]) => mockDiscoverInboxUri(...args),
}));

vi.mock('@/infrastructure/inbox/inboxSubscription', () => ({
  subscribeToInbox: (...args: unknown[]) => mockSubscribeToInbox(...args),
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({
  SolidProfileShapeType: {},
}));

vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isLoadable: () => true,
}));

vi.mock('@/shared/contexts/NotificationContext', () => ({
  useNotifications: () => ({
    showInfo: mockShowInfo,
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showToast: vi.fn(),
    confirm: vi.fn(),
  }),
}));

vi.mock('@/features/profile/hooks/useAccessRequests', () => ({
  useAccessRequests: (...args: unknown[]) => mockUseAccessRequests(...args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, options?: Record<string, unknown>) => {
      if (options && typeof options === 'object') {
        const { name, description } = options as { name?: string; description?: string };
        if (key === 'requestNotifications.toast' && name) {
          return `${name} ${description ?? ''}`.trim();
        }
        if (key === 'requestsPanel.requestsFileAccess') {
          return `wants access to ${(options as { resource?: string }).resource ?? ''}`.trim();
        }
        if (key === 'requestsPanel.requestsTypeAccess') {
          return `wants access to all ${(options as { type?: string }).type ?? ''} files`.trim();
        }
      }
      if (key === 'requestsPanel.requestsAccess') return 'wants access to your catalog';
      return key;
    },
  ],
}));

vi.mock('@/infrastructure/validation/fileTypeRegistry', () => ({
  getFileTypeInfo: (uri: string) => ({ label: uri, description: '' }),
}));

import {
  RequestNotificationsProvider,
} from '../RequestNotificationsContext-file/RequestNotificationsContext';
import { useRequestNotifications } from '../RequestNotificationsContext-file/requestNotificationsContextValue';

type Captured = ReturnType<typeof useRequestNotifications>;

const CaptureValue: React.FC<{ onValue: (value: Captured) => void }> = ({ onValue }) => {
  const value = useRequestNotifications();
  useEffect(() => onValue(value), [value, onValue]);
  return null;
};

const makeRequest = (overrides: Partial<AccessRequest> = {}): AccessRequest => ({
  messageUri: 'https://pod.example/inbox/msg1',
  requesterWebId: 'https://alice.solidcommunity.net/profile/card#me',
  accessTo: '',
  requestType: 'catalog',
  timestamp: '2026-05-20T10:00:00Z',
  ...overrides,
});

const setupAccessReturn = (requests: AccessRequest[]) => {
  mockUseAccessRequests.mockReturnValue({
    requests,
    loading: false,
    error: null,
    busyMessageUri: null,
    loadRequests: vi.fn().mockResolvedValue(undefined),
    approve: vi.fn(),
    deny: vi.fn(),
  });
};

const futureTimestamp = (): string => new Date(Date.now() + 60_000).toISOString();

const renderProvider = (requests: AccessRequest[]) => {
  setupAccessReturn(requests);
  let captured: Captured = null;
  const utils = render(
    <RequestNotificationsProvider
      ownerWebId="https://owner.example/profile/card#me"
      storageRoot="https://owner.example/"
      catalogUri="https://owner.example/catalog.ttl"
    >
      <CaptureValue
        onValue={(value) => {
          captured = value;
        }}
      />
    </RequestNotificationsProvider>,
  );
  return { ...utils, getValue: () => captured };
};

describe('RequestNotificationsContext', () => {
  beforeEach(() => {
    localStorage.clear();
    mockShowInfo.mockClear();
    mockUseAccessRequests.mockReset();
    mockSubscribeToInbox.mockReset();
    mockDiscoverInboxUri.mockReset();
    mockSolidFetch.mockReset();
    mockSubscribeToInbox.mockRejectedValue(new Error('no subscription in test'));
    mockDiscoverInboxUri.mockResolvedValue('https://owner.example/inbox/');
  });

  it('useRequestNotifications returns null when no provider', () => {
    let captured: Captured = undefined as unknown as Captured;
    const Probe: React.FC = () => {
      const value = useRequestNotifications();
      useEffect(() => {
        captured = value;
      }, [value]);
      return null;
    };
    render(<Probe />);
    expect(captured).toBeNull();
  });

  it('exposes the access request list', () => {
    const request = makeRequest();
    const { getValue } = renderProvider([request]);
    expect(getValue()?.requests).toEqual([request]);
  });

  it('reports the unseen count when nothing has been marked seen', () => {
    const { getValue } = renderProvider([makeRequest(), makeRequest({ messageUri: 'urn:msg:2' })]);
    expect(getValue()?.unseenCount).toBe(2);
  });

  it('does not toast for requests whose timestamp predates the provider mount', () => {
    renderProvider([makeRequest()]);
    expect(mockShowInfo).not.toHaveBeenCalled();
  });

  it('toasts for newly arrived requests whose timestamp is after mount', () => {
    setupAccessReturn([makeRequest()]);
    const { rerender } = render(
      <RequestNotificationsProvider
        ownerWebId="https://owner.example/profile/card#me"
        storageRoot="https://owner.example/"
        catalogUri="https://owner.example/catalog.ttl"
      >
        <span />
      </RequestNotificationsProvider>,
    );
    expect(mockShowInfo).not.toHaveBeenCalled();

    setupAccessReturn([
      makeRequest(),
      makeRequest({
        messageUri: 'urn:msg:2',
        requesterWebId: 'https://bob.solidcommunity.net/profile/card#me',
        timestamp: futureTimestamp(),
      }),
    ]);
    rerender(
      <RequestNotificationsProvider
        ownerWebId="https://owner.example/profile/card#me"
        storageRoot="https://owner.example/"
        catalogUri="https://owner.example/catalog.ttl"
      >
        <span />
      </RequestNotificationsProvider>,
    );
    expect(mockShowInfo).toHaveBeenCalledTimes(1);
    expect(mockShowInfo).toHaveBeenCalledWith(expect.stringContaining('bob'));
  });

  it('skips toast for newly arrived requests already in the persisted seen set', () => {
    localStorage.setItem(
      'solid-drive.seenRequestIds',
      JSON.stringify(['urn:msg:2']),
    );
    setupAccessReturn([makeRequest()]);
    const { rerender } = render(
      <RequestNotificationsProvider
        ownerWebId="https://owner.example/profile/card#me"
        storageRoot="https://owner.example/"
        catalogUri="https://owner.example/catalog.ttl"
      >
        <span />
      </RequestNotificationsProvider>,
    );
    setupAccessReturn([
      makeRequest(),
      makeRequest({ messageUri: 'urn:msg:2', timestamp: futureTimestamp() }),
    ]);
    rerender(
      <RequestNotificationsProvider
        ownerWebId="https://owner.example/profile/card#me"
        storageRoot="https://owner.example/"
        catalogUri="https://owner.example/catalog.ttl"
      >
        <span />
      </RequestNotificationsProvider>,
    );
    expect(mockShowInfo).not.toHaveBeenCalled();
  });

  it('markAllSeen marks every loaded request as seen', () => {
    const { getValue } = renderProvider([
      makeRequest({ messageUri: 'urn:msg:1' }),
      makeRequest({ messageUri: 'urn:msg:2' }),
    ]);
    act(() => {
      getValue()?.markAllSeen();
    });
    expect(getValue()?.unseenCount).toBe(0);
    expect(getValue()?.isSeen('urn:msg:1')).toBe(true);
    expect(getValue()?.isSeen('urn:msg:2')).toBe(true);
  });

  it('selectRequest updates the selected id', () => {
    const { getValue } = renderProvider([makeRequest()]);
    act(() => {
      getValue()?.selectRequest('urn:msg:1');
    });
    expect(getValue()?.selectedRequestId).toBe('urn:msg:1');
    act(() => {
      getValue()?.selectRequest(null);
    });
    expect(getValue()?.selectedRequestId).toBeNull();
  });

  it('selectRequest bumps the navigationCount each call', () => {
    const { getValue } = renderProvider([makeRequest()]);
    const before = getValue()?.navigationCount ?? 0;
    act(() => {
      getValue()?.selectRequest('urn:msg:1');
    });
    expect(getValue()?.navigationCount).toBe(before + 1);
    act(() => {
      getValue()?.selectRequest('urn:msg:1');
    });
    expect(getValue()?.navigationCount).toBe(before + 2);
  });

  it('selectRequest triggers loadRequests for a fresh fetch', () => {
    const loadRequests = vi.fn().mockResolvedValue(undefined);
    mockUseAccessRequests.mockReturnValue({
      requests: [makeRequest()],
      loading: false,
      error: null,
      busyMessageUri: null,
      loadRequests,
      approve: vi.fn(),
      deny: vi.fn(),
    });
    const captured: { value: Captured } = { value: null };
    render(
      <RequestNotificationsProvider
        ownerWebId="https://owner.example/profile/card#me"
        storageRoot="https://owner.example/"
        catalogUri="https://owner.example/catalog.ttl"
      >
        <CaptureValue onValue={(value) => { captured.value = value; }} />
      </RequestNotificationsProvider>,
    );
    loadRequests.mockClear();
    act(() => {
      captured.value?.selectRequest('urn:msg:1');
    });
    expect(loadRequests).toHaveBeenCalledTimes(1);
  });

  it('exposes loading, error, busyMessageUri, approve and deny from the underlying hook', () => {
    const approve = vi.fn();
    const deny = vi.fn();
    mockUseAccessRequests.mockReturnValue({
      requests: [],
      loading: true,
      error: 'boom',
      busyMessageUri: 'urn:msg:busy',
      loadRequests: vi.fn(),
      approve,
      deny,
    });
    const captured: { value: Captured } = { value: null };
    render(
      <RequestNotificationsProvider
        ownerWebId="https://owner.example/profile/card#me"
        storageRoot="https://owner.example/"
        catalogUri="https://owner.example/catalog.ttl"
      >
        <CaptureValue onValue={(value) => { captured.value = value; }} />
      </RequestNotificationsProvider>,
    );
    expect(captured.value?.loading).toBe(true);
    expect(captured.value?.error).toBe('boom');
    expect(captured.value?.busyMessageUri).toBe('urn:msg:busy');
    expect(captured.value?.approve).toBe(approve);
    expect(captured.value?.deny).toBe(deny);
  });

  it('opens a Solid Notifications WebSocket subscription on the inbox', async () => {
    const loadRequests = vi.fn().mockResolvedValue(undefined);
    mockUseAccessRequests.mockReturnValue({
      requests: [],
      loading: false,
      error: null,
      busyMessageUri: null,
      loadRequests,
      approve: vi.fn(),
      deny: vi.fn(),
    });
    const close = vi.fn();
    let notify: () => void = () => {};
    mockSubscribeToInbox.mockImplementation(
      async (_inboxUri: string, _fetch: unknown, onNotify: () => void) => {
        notify = onNotify;
        return { close };
      },
    );

    render(
      <RequestNotificationsProvider
        ownerWebId="https://owner.example/profile/card#me"
        storageRoot="https://owner.example/"
        catalogUri="https://owner.example/catalog.ttl"
      >
        <span />
      </RequestNotificationsProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockSubscribeToInbox).toHaveBeenCalledWith(
      'https://owner.example/inbox/',
      expect.any(Function),
      expect.any(Function),
    );

    act(() => notify());
    expect(loadRequests).toHaveBeenCalled();
  });

  it('never triggers loadRequests on a timer when no notification arrives', async () => {
    vi.useFakeTimers();
    const loadRequests = vi.fn().mockResolvedValue(undefined);
    mockUseAccessRequests.mockReturnValue({
      requests: [],
      loading: false,
      error: null,
      busyMessageUri: null,
      loadRequests,
      approve: vi.fn(),
      deny: vi.fn(),
    });
    mockSubscribeToInbox.mockResolvedValue({ close: vi.fn() });

    render(
      <RequestNotificationsProvider
        ownerWebId="https://owner.example/profile/card#me"
        storageRoot="https://owner.example/"
        catalogUri="https://owner.example/catalog.ttl"
      >
        <span />
      </RequestNotificationsProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(loadRequests).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('refreshes when the window regains focus', () => {
    const loadRequests = vi.fn().mockResolvedValue(undefined);
    mockUseAccessRequests.mockReturnValue({
      requests: [],
      loading: false,
      error: null,
      busyMessageUri: null,
      loadRequests,
      approve: vi.fn(),
      deny: vi.fn(),
    });
    render(
      <RequestNotificationsProvider
        ownerWebId="https://owner.example/profile/card#me"
        storageRoot="https://owner.example/"
        catalogUri="https://owner.example/catalog.ttl"
      >
        <span />
      </RequestNotificationsProvider>,
    );
    expect(loadRequests).not.toHaveBeenCalled();
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(loadRequests).toHaveBeenCalledTimes(1);
  });

  it('refreshes when the document becomes visible', () => {
    const loadRequests = vi.fn().mockResolvedValue(undefined);
    mockUseAccessRequests.mockReturnValue({
      requests: [],
      loading: false,
      error: null,
      busyMessageUri: null,
      loadRequests,
      approve: vi.fn(),
      deny: vi.fn(),
    });
    render(
      <RequestNotificationsProvider
        ownerWebId="https://owner.example/profile/card#me"
        storageRoot="https://owner.example/"
        catalogUri="https://owner.example/catalog.ttl"
      >
        <span />
      </RequestNotificationsProvider>,
    );
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(loadRequests).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AccessRequest } from '@/infrastructure/inbox/inboxAccess';

const mockSelectRequest = vi.fn();
const mockMarkSeen = vi.fn();
const mockMarkAllSeen = vi.fn();
const mockNavigate = vi.fn();

let mockProfileLoading = false;

vi.mock('@ldo/solid-react', () => ({
  useResource: () => ({ isLoading: () => mockProfileLoading }),
  useSubject: (_shapeType: unknown, webId: string | undefined) => {
    if (!webId) return undefined;
    if (webId.includes('alice')) return { name: 'Alice Doe' };
    if (webId.includes('bob')) return { name: 'Bob Builder' };
    return undefined;
  },
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({
  SolidProfileShapeType: {},
}));

vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isLoadable: () => true,
}));

let mockContextValue: {
  requests: AccessRequest[];
  unseenCount: number;
  isSeen: (id: string) => boolean;
  markSeen: typeof mockMarkSeen;
  markAllSeen: typeof mockMarkAllSeen;
  selectedRequestId: string | null;
  selectRequest: typeof mockSelectRequest;
} | null = null;

vi.mock('@/features/profile/contexts/RequestNotificationsContext', () => ({
  useRequestNotifications: () => mockContextValue,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, options?: Record<string, unknown> | string) => {
      if (typeof options === 'string') return options;
      if (options && typeof options === 'object') {
        const opts = options as { defaultValue?: string; count?: number; resource?: string; type?: string };
        if (key === 'notificationBell.label' && opts.defaultValue) {
          return `${opts.count ?? 0} pending requests`;
        }
        if (key === 'requestsPanel.requestsFileAccess') {
          return `wants access to ${opts.resource ?? ''}`.trim();
        }
        if (key === 'requestsPanel.requestsTypeAccess') {
          return `wants access to all ${opts.type ?? ''} files`.trim();
        }
      }
      if (key === 'notificationBell.heading') return 'Recent requests';
      if (key === 'notificationBell.empty') return 'No new requests';
      if (key === 'notificationBell.viewAll') return 'View all requests';
      if (key === 'requestsPanel.requestsAccess') return 'wants access to your catalog';
      return key;
    },
  ],
}));

vi.mock('@/infrastructure/validation/fileTypeRegistry', () => ({
  getFileTypeInfo: (uri: string) => ({ label: uri, description: '' }),
}));

vi.mock('@/config', () => ({
  DEFAULT_LOCALE: 'en-US',
  SHORT_DATE_FORMAT_OPTIONS: { year: 'numeric', month: 'short', day: 'numeric' },
  NOTIFICATION_BELL_MAX_DROPDOWN_ITEMS: 6,
  NOTIFICATION_BELL_MAX_BADGE_DISPLAY: 9,
}));

import { NotificationBell } from '../NotificationBell-file/NotificationBell';

const makeRequest = (overrides: Partial<AccessRequest> = {}): AccessRequest => ({
  messageUri: 'https://pod.example/inbox/msg1',
  requesterWebId: 'https://alice.solidcommunity.net/profile/card#me',
  accessTo: '',
  requestType: 'catalog',
  timestamp: '2026-05-20T10:00:00Z',
  ...overrides,
});

const setContext = (overrides: Partial<NonNullable<typeof mockContextValue>> = {}) => {
  mockContextValue = {
    requests: [],
    unseenCount: 0,
    isSeen: () => false,
    markSeen: mockMarkSeen,
    markAllSeen: mockMarkAllSeen,
    selectedRequestId: null,
    selectRequest: mockSelectRequest,
    ...overrides,
  };
};

beforeEach(() => {
  mockSelectRequest.mockClear();
  mockMarkSeen.mockClear();
  mockMarkAllSeen.mockClear();
  mockNavigate.mockClear();
  mockContextValue = null;
  mockProfileLoading = false;
});

describe('NotificationBell — badge', () => {
  it('renders without a badge when there is no provider', () => {
    mockContextValue = null;
    render(<NotificationBell />);
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
    expect(screen.queryByTestId('notification-bell-badge')).not.toBeInTheDocument();
  });

  it('hides the badge when the unseen count is 0', () => {
    setContext({ unseenCount: 0 });
    render(<NotificationBell />);
    expect(screen.queryByTestId('notification-bell-badge')).not.toBeInTheDocument();
  });

  it('shows the badge with the unseen count', () => {
    setContext({ requests: [makeRequest()], unseenCount: 3 });
    render(<NotificationBell />);
    expect(screen.getByTestId('notification-bell-badge')).toHaveTextContent('3');
  });

  it('caps the badge display at "9+"', () => {
    setContext({ unseenCount: 42, requests: [] });
    render(<NotificationBell />);
    expect(screen.getByTestId('notification-bell-badge')).toHaveTextContent('9+');
  });
});

describe('NotificationBell — dropdown', () => {
  it('lists recent requests with their resolved profile names', async () => {
    const user = userEvent.setup();
    const requestOne = makeRequest({ messageUri: 'urn:msg:1' });
    const requestTwo = makeRequest({
      messageUri: 'urn:msg:2',
      requesterWebId: 'https://bob.solidcommunity.net/profile/card#me',
    });
    setContext({ requests: [requestOne, requestTwo], unseenCount: 2 });
    render(<NotificationBell />);
    await user.click(screen.getByTestId('notification-bell'));
    expect(await screen.findByText('Alice Doe')).toBeInTheDocument();
    expect(screen.getByText('Bob Builder')).toBeInTheDocument();
  });

  it('renders the empty hint when no requests exist', async () => {
    const user = userEvent.setup();
    setContext({ requests: [], unseenCount: 0 });
    render(<NotificationBell />);
    await user.click(screen.getByTestId('notification-bell'));
    expect(await screen.findByText('No new requests')).toBeInTheDocument();
  });

  it('selecting a request calls onNavigateToRequests and tracks the selection', async () => {
    const user = userEvent.setup();
    const request = makeRequest({ messageUri: 'urn:msg:1' });
    setContext({ requests: [request], unseenCount: 1 });
    render(<NotificationBell onNavigateToRequests={mockNavigate} />);
    await user.click(screen.getByTestId('notification-bell'));
    await user.click(await screen.findByText('Alice Doe'));
    expect(mockSelectRequest).toHaveBeenCalledWith('urn:msg:1');
    expect(mockNavigate).toHaveBeenCalledWith('urn:msg:1');
  });

  it('"View all" clears the selection and calls onNavigateToRequests with null', async () => {
    const user = userEvent.setup();
    setContext({ requests: [makeRequest()], unseenCount: 1 });
    render(<NotificationBell onNavigateToRequests={mockNavigate} />);
    await user.click(screen.getByTestId('notification-bell'));
    await user.click(await screen.findByText('View all requests'));
    expect(mockNavigate).toHaveBeenCalledWith(null);
    expect(mockSelectRequest).toHaveBeenCalledWith(null);
  });

  it('omits the "View all" link when no navigation callback is wired', async () => {
    const user = userEvent.setup();
    setContext({ requests: [makeRequest()], unseenCount: 1 });
    render(<NotificationBell />);
    await user.click(screen.getByTestId('notification-bell'));
    expect(screen.queryByText('View all requests')).not.toBeInTheDocument();
  });

  it('renders a file-request description with the resource label', async () => {
    const user = userEvent.setup();
    const request = makeRequest({
      requestType: 'file',
      accessTo: 'https://owner.example/files/photo.jpg/',
    });
    setContext({ requests: [request], unseenCount: 1 });
    render(<NotificationBell />);
    await user.click(screen.getByTestId('notification-bell'));
    expect(await screen.findByText(/wants access to photo\.jpg/)).toBeInTheDocument();
  });

  it('renders a type-request description with the type label', async () => {
    const user = userEvent.setup();
    const request = makeRequest({
      requestType: 'type',
      forClass: 'https://schema.org/Photograph',
    });
    setContext({ requests: [request], unseenCount: 1 });
    render(<NotificationBell />);
    await user.click(screen.getByTestId('notification-bell'));
    expect(
      await screen.findByText(/wants access to all https:\/\/schema\.org\/Photograph files/),
    ).toBeInTheDocument();
  });

  it('renders without a time element when the timestamp is missing', async () => {
    const user = userEvent.setup();
    const request = makeRequest({ timestamp: '' });
    setContext({ requests: [request], unseenCount: 1 });
    const { container } = render(<NotificationBell />);
    await user.click(screen.getByTestId('notification-bell'));
    await screen.findByText('Alice Doe');
    expect(container.querySelector('time')).toBeNull();
  });

  it('renders without a time element when the timestamp is unparseable', async () => {
    const user = userEvent.setup();
    const request = makeRequest({ timestamp: 'not-a-date' });
    setContext({ requests: [request], unseenCount: 1 });
    const { container } = render(<NotificationBell />);
    await user.click(screen.getByTestId('notification-bell'));
    await screen.findByText('Alice Doe');
    expect(container.querySelector('time')).toBeNull();
  });

  it('shows the loading placeholder while the profile resource is still loading', async () => {
    mockProfileLoading = true;
    const user = userEvent.setup();
    setContext({ requests: [makeRequest()], unseenCount: 1 });
    render(<NotificationBell />);
    await user.click(screen.getByTestId('notification-bell'));
    expect(await screen.findByText('Loading…')).toBeInTheDocument();
  });
});

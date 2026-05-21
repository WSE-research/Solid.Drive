import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { AccessRequest } from '@/infrastructure/inbox/inboxAccess';
import { RequestsPanel } from '../RequestsPanel-file/RequestsPanel';

const mockLoadRequests = vi.fn();
const mockApprove = vi.fn();
const mockDeny = vi.fn();
const mockMarkSeen = vi.fn();
const mockMarkAllSeen = vi.fn();
const mockSelectRequest = vi.fn();
const mockIsSeen = vi.fn(() => false);

const buildNotifications = (overrides: Partial<typeof DEFAULT_NOTIFICATIONS> = {}) => ({
  ...DEFAULT_NOTIFICATIONS,
  ...overrides,
});

const DEFAULT_NOTIFICATIONS = {
  requests: [] as AccessRequest[],
  loading: false,
  error: null as string | null,
  busyMessageUri: null as string | null,
  loadRequests: mockLoadRequests,
  approve: mockApprove,
  deny: mockDeny,
  unseenCount: 0,
  isSeen: mockIsSeen,
  markSeen: mockMarkSeen,
  markAllSeen: mockMarkAllSeen,
  selectedRequestId: null as string | null,
  selectRequest: mockSelectRequest,
  navigationCount: 0,
};

let hookReturnValue: typeof DEFAULT_NOTIFICATIONS = { ...DEFAULT_NOTIFICATIONS };

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string, params?: Record<string, string>) => {
    if (params?.resource) return `${key}:${params.resource}`;
    if (params?.type) return `${key}:${params.type}`;
    return key;
  }],
}));

let mockResourceLoading = false;
let mockSubjectValue: Record<string, unknown> | null = {
  name: 'Requester',
  fn: null,
  img: { '@id': 'https://req.example/avatar.png' },
};

vi.mock('@ldo/solid-react', () => ({
  useResource: () => ({ isLoading: () => mockResourceLoading }),
  useSubject: () => mockSubjectValue,
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({
  SolidProfileShapeType: {},
}));

vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isLoadable: () => true,
}));

vi.mock('@/features/profile/contexts/RequestNotificationsContext', () => ({
  useRequestNotifications: () => hookReturnValue,
}));

vi.mock('@/config', () => ({
  MAX_DISPLAY_NAME_LENGTH: 30,
  DEFAULT_LOCALE: 'en-US',
  SHORT_DATE_FORMAT_OPTIONS: { month: 'short', day: 'numeric' },
}));

vi.mock('@/shared/components/Avatar', () => ({
  Avatar: ({ alt }: { alt: string }) => <div data-testid="avatar">{alt}</div>,
}));

vi.mock('@/shared/utils', () => ({
  getInitial: (name: string) => name.charAt(0).toUpperCase(),
  getProfileDisplayName: (contact: unknown, webId: string) => (contact as Record<string, string>)?.name ?? webId,
  getWebIdFallbackName: (webId: string) => webId,
  truncateDisplayName: (name: string) => (name.length > 30 ? `${name.slice(0, 30)}…` : name),
}));

vi.mock('@/infrastructure/validation/fileTypeRegistry', () => ({
  getFileTypeInfo: (uri: string) => ({
    label: uri === 'http://schema.org/ImageObject' ? 'Image' : 'Document',
    description: 'test',
  }),
}));

describe('RequestsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadRequests.mockResolvedValue(undefined);
    mockApprove.mockResolvedValue(undefined);
    mockDeny.mockResolvedValue(undefined);
    mockIsSeen.mockReturnValue(false);
    mockResourceLoading = false;
    mockSubjectValue = {
      name: 'Requester',
      fn: null,
      img: { '@id': 'https://req.example/avatar.png' },
    };
    hookReturnValue = buildNotifications();
  });

  it('renders toggle button with heading', () => {
    render(<RequestsPanel />);
    expect(screen.getByText('requestsPanel.heading')).toBeInTheDocument();
  });

  it('renders a chevron icon inside the toggle button for expand/collapse indication', () => {
    render(<RequestsPanel />);
    expect(document.querySelector('.requests-panel__chevron')).toBeInTheDocument();
  });

  it('does not show body when collapsed', () => {
    render(<RequestsPanel />);
    expect(document.querySelector('requests-panel-body')).not.toBeInTheDocument();
  });

  it('shows body when toggle is clicked', () => {
    render(<RequestsPanel />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(document.querySelector('requests-panel-body')).toBeInTheDocument();
  });

  it('calls loadRequests when opened', () => {
    render(<RequestsPanel />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(mockLoadRequests).toHaveBeenCalled();
  });

  it('shows loading spinner and text while access requests are being fetched', () => {
    hookReturnValue = { ...hookReturnValue, loading: true };
    render(<RequestsPanel />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(document.querySelector('requests-panel-loading')).toBeInTheDocument();
    expect(screen.getByText('requestsPanel.loading')).toBeInTheDocument();
  });

  it('shows error message when loading requests fails', () => {
    hookReturnValue = { ...hookReturnValue, error: 'Failed to load' };
    render(<RequestsPanel />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });

  it('shows empty message when no requests and not loading', () => {
    render(<RequestsPanel />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(screen.getByText('requestsPanel.noRequests')).toBeInTheDocument();
  });

  it('shows badge when requests exist', () => {
    hookReturnValue = {
      ...hookReturnValue,
      requests: [
        { messageUri: 'msg1', requesterWebId: 'https://req.example/card#me', accessTo: 'https://owner.example/files/', requestType: 'catalog', timestamp: '' },
      ],
    };
    render(<RequestsPanel />);
    expect(document.querySelector('.requests-panel__badge')).toHaveTextContent('1');
  });

  it('does not show badge when no requests', () => {
    render(<RequestsPanel />);
    expect(document.querySelector('.requests-panel__badge')).not.toBeInTheDocument();
  });

  it('renders request items with approve and deny buttons', () => {
    hookReturnValue = {
      ...hookReturnValue,
      requests: [
        { messageUri: 'msg1', requesterWebId: 'https://req.example/card#me', accessTo: 'https://owner.example/files/', requestType: 'catalog', timestamp: '' },
      ],
    };
    render(<RequestsPanel />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(screen.getByText('requestsPanel.approve')).toBeInTheDocument();
    expect(screen.getByText('requestsPanel.deny')).toBeInTheDocument();
  });

  it('calls approve when approve button is clicked', async () => {
    const request = { messageUri: 'msg1', requesterWebId: 'https://req.example/card#me', accessTo: 'https://owner.example/files/', requestType: 'catalog' as const, timestamp: '' };
    hookReturnValue = { ...hookReturnValue, requests: [request] };
    render(<RequestsPanel />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    await act(async () => {
      fireEvent.click(screen.getByText('requestsPanel.approve'));
    });
    expect(mockApprove).toHaveBeenCalledWith(request);
  });

  it('calls deny when deny button is clicked', async () => {
    const request = { messageUri: 'msg1', requesterWebId: 'https://req.example/card#me', accessTo: 'https://owner.example/files/', requestType: 'catalog' as const, timestamp: '' };
    hookReturnValue = { ...hookReturnValue, requests: [request] };
    render(<RequestsPanel />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    await act(async () => {
      fireEvent.click(screen.getByText('requestsPanel.deny'));
    });
    expect(mockDeny).toHaveBeenCalledWith(request);
  });

  it('disables buttons when isBusy for that request', () => {
    const request = { messageUri: 'msg1', requesterWebId: 'https://req.example/card#me', accessTo: 'https://owner.example/files/', requestType: 'catalog' as const, timestamp: '' };
    hookReturnValue = { ...hookReturnValue, requests: [request], busyMessageUri: 'msg1' };
    render(<RequestsPanel />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(screen.getByText('requestsPanel.approve')).toBeDisabled();
    expect(screen.getByText('requestsPanel.deny')).toBeDisabled();
  });

  it('renders refresh button when open and not loading', () => {
    render(<RequestsPanel />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(screen.getByText('requestsPanel.refresh')).toBeInTheDocument();
  });

  it('shows description for catalog request type', () => {
    hookReturnValue = {
      ...hookReturnValue,
      requests: [
        { messageUri: 'msg1', requesterWebId: 'https://req.example/card#me', accessTo: 'https://owner.example/files/', requestType: 'catalog', timestamp: '' },
      ],
    };
    render(<RequestsPanel />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(screen.getByText('requestsPanel.requestsAccess')).toBeInTheDocument();
  });

  it('shows description for file request type with resource label', () => {
    hookReturnValue = {
      ...hookReturnValue,
      requests: [
        { messageUri: 'msg2', requesterWebId: 'https://req.example/card#me', accessTo: 'https://owner.example/files/my%20doc.ttl', requestType: 'file', timestamp: '' },
      ],
    };
    render(<RequestsPanel />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(screen.getByText('requestsPanel.requestsFileAccess:my doc.ttl')).toBeInTheDocument();
  });

  it('shows description for type request with the category label', () => {
    hookReturnValue = {
      ...hookReturnValue,
      requests: [
        {
          messageUri: 'msg-type',
          requesterWebId: 'https://req.example/card#me',
          accessTo: '',
          requestType: 'type',
          forClass: 'http://schema.org/ImageObject',
          timestamp: '',
        },
      ],
    };
    render(<RequestsPanel />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(screen.getByText('requestsPanel.requestsTypeAccess:Image')).toBeInTheDocument();
  });

  it('shows timestamp when provided', () => {
    hookReturnValue = {
      ...hookReturnValue,
      requests: [
        { messageUri: 'msg1', requesterWebId: 'https://req.example/card#me', accessTo: 'https://owner.example/', requestType: 'catalog', timestamp: '2025-03-15T10:00:00Z' },
      ],
    };
    render(<RequestsPanel />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    const timestampEl = document.querySelector('.requests-panel__timestamp');
    expect(timestampEl).toBeInTheDocument();
    expect(timestampEl!.textContent).toBeTruthy();
  });

  it('renders requester avatar and name', () => {
    hookReturnValue = {
      ...hookReturnValue,
      requests: [
        { messageUri: 'msg1', requesterWebId: 'https://req.example/card#me', accessTo: 'https://owner.example/', requestType: 'catalog', timestamp: '' },
      ],
    };
    render(<RequestsPanel />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(screen.getByTestId('avatar')).toBeInTheDocument();
    expect(document.querySelector('.requests-panel__requester-name')).toHaveTextContent('Requester');
  });

  it('collapses panel when toggle is clicked again', () => {
    render(<RequestsPanel />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(document.querySelector('requests-panel-body')).toBeInTheDocument();
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(document.querySelector('requests-panel-body')).not.toBeInTheDocument();
  });

  it('shows loading text in RequesterRow when contact resource is loading', () => {
    mockResourceLoading = true;
    hookReturnValue = {
      ...hookReturnValue,
      requests: [
        { messageUri: 'msg1', requesterWebId: 'https://req.example/card#me', accessTo: 'https://owner.example/', requestType: 'catalog', timestamp: '' },
      ],
    };
    render(<RequestsPanel />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(document.querySelector('.requests-panel__requester-name')).toHaveTextContent('requestsPanel.loading');
  });

  it('truncates long display names in RequesterRow', () => {
    // MAX_DISPLAY_NAME_LENGTH is mocked as 30, so a 40-char name should truncate
    mockSubjectValue = { name: 'A'.repeat(40), fn: null, img: null };
    hookReturnValue = {
      ...hookReturnValue,
      requests: [
        { messageUri: 'msg1', requesterWebId: 'https://req.example/card#me', accessTo: 'https://owner.example/', requestType: 'catalog', timestamp: '' },
      ],
    };
    render(<RequestsPanel />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    const nameEl = document.querySelector('.requests-panel__requester-name');
    expect(nameEl?.textContent).toContain('…');
    expect(nameEl?.textContent?.length).toBeLessThanOrEqual(31); // 30 chars + ellipsis
  });

  it('auto-opens when the notification bell triggers a navigation', () => {
    hookReturnValue = buildNotifications({
      navigationCount: 0,
      requests: [
        { messageUri: 'msg1', requesterWebId: 'https://req.example/card#me', accessTo: 'https://owner.example/', requestType: 'catalog', timestamp: '2026-05-20T10:00:00Z' },
      ],
    });
    const { rerender } = render(<RequestsPanel />);
    expect(document.querySelector('requests-panel-body')).toBeNull();

    hookReturnValue = buildNotifications({
      navigationCount: 1,
      selectedRequestId: 'msg1',
      requests: hookReturnValue.requests,
    });
    rerender(<RequestsPanel />);
    expect(document.querySelector('requests-panel-body')).not.toBeNull();
  });

  it('marks every visible request as seen once the panel is open', () => {
    hookReturnValue = buildNotifications({
      requests: [
        { messageUri: 'msg1', requesterWebId: 'https://req.example/card#me', accessTo: 'https://owner.example/', requestType: 'catalog', timestamp: '2026-05-20T10:00:00Z' },
        { messageUri: 'msg2', requesterWebId: 'https://req2.example/card#me', accessTo: 'https://owner.example/', requestType: 'catalog', timestamp: '2026-05-20T11:00:00Z' },
      ],
    });
    render(<RequestsPanel />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(mockMarkSeen).toHaveBeenCalledWith(['msg1', 'msg2']);
  });

  it('flags the matching item as highlighted when selectedRequestId is set', () => {
    hookReturnValue = buildNotifications({
      selectedRequestId: 'msg2',
      requests: [
        { messageUri: 'msg1', requesterWebId: 'https://a.example/card#me', accessTo: 'https://owner.example/', requestType: 'catalog', timestamp: '' },
        { messageUri: 'msg2', requesterWebId: 'https://b.example/card#me', accessTo: 'https://owner.example/', requestType: 'catalog', timestamp: '' },
      ],
    });
    render(<RequestsPanel />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    const items = document.querySelectorAll('requests-panel-item');
    expect(items).toHaveLength(2);
    expect(items[0].getAttribute('data-highlighted')).toBeNull();
    expect(items[1].getAttribute('data-highlighted')).toBe('true');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { AccessRequest } from '@/infrastructure/inbox/inboxAccess';
import { RequestsPanel } from '../RequestsPanel-file/RequestsPanel';

const mockLoadRequests = vi.fn();
const mockApprove = vi.fn();
const mockDeny = vi.fn();

let hookReturnValue = {
  requests: [] as AccessRequest[],
  loading: false,
  error: null as string | null,
  busyMessageUri: null as string | null,
  loadRequests: mockLoadRequests,
  approve: mockApprove,
  deny: mockDeny,
};

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string, params?: Record<string, string>) => {
    if (params?.resource) return `${key}:${params.resource}`;
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

vi.mock('@/features/profile/hooks/useAccessRequests', () => ({
  useAccessRequests: () => hookReturnValue,
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
}));

const baseProps = {
  ownerWebId: 'https://owner.example/profile/card#me',
  storageRoot: 'https://owner.example/',
  catalogUri: 'https://owner.example/solidweb/catalog.ttl',
};

describe('RequestsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadRequests.mockResolvedValue(undefined);
    mockApprove.mockResolvedValue(undefined);
    mockDeny.mockResolvedValue(undefined);
    mockResourceLoading = false;
    mockSubjectValue = {
      name: 'Requester',
      fn: null,
      img: { '@id': 'https://req.example/avatar.png' },
    };
    hookReturnValue = {
      requests: [],
      loading: false,
      error: null,
      busyMessageUri: null,
      loadRequests: mockLoadRequests,
      approve: mockApprove,
      deny: mockDeny,
    };
  });

  it('renders toggle button with heading', () => {
    render(<RequestsPanel {...baseProps} />);
    expect(screen.getByText('requestsPanel.heading')).toBeInTheDocument();
  });

  it('renders a chevron icon inside the toggle button for expand/collapse indication', () => {
    render(<RequestsPanel {...baseProps} />);
    expect(document.querySelector('.requests-panel__chevron')).toBeInTheDocument();
  });

  it('does not show body when collapsed', () => {
    render(<RequestsPanel {...baseProps} />);
    expect(document.querySelector('.requests-panel__body')).not.toBeInTheDocument();
  });

  it('shows body when toggle is clicked', () => {
    render(<RequestsPanel {...baseProps} />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(document.querySelector('.requests-panel__body')).toBeInTheDocument();
  });

  it('calls loadRequests when opened', () => {
    render(<RequestsPanel {...baseProps} />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(mockLoadRequests).toHaveBeenCalled();
  });

  it('shows loading spinner and text while access requests are being fetched', () => {
    hookReturnValue = { ...hookReturnValue, loading: true };
    render(<RequestsPanel {...baseProps} />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(document.querySelector('.requests-panel__loading')).toBeInTheDocument();
    expect(screen.getByText('requestsPanel.loading')).toBeInTheDocument();
  });

  it('shows error message when loading requests fails', () => {
    hookReturnValue = { ...hookReturnValue, error: 'Failed to load' };
    render(<RequestsPanel {...baseProps} />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });

  it('shows empty message when no requests and not loading', () => {
    render(<RequestsPanel {...baseProps} />);
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
    render(<RequestsPanel {...baseProps} />);
    expect(document.querySelector('.requests-panel__badge')).toHaveTextContent('1');
  });

  it('does not show badge when no requests', () => {
    render(<RequestsPanel {...baseProps} />);
    expect(document.querySelector('.requests-panel__badge')).not.toBeInTheDocument();
  });

  it('renders request items with approve and deny buttons', () => {
    hookReturnValue = {
      ...hookReturnValue,
      requests: [
        { messageUri: 'msg1', requesterWebId: 'https://req.example/card#me', accessTo: 'https://owner.example/files/', requestType: 'catalog', timestamp: '' },
      ],
    };
    render(<RequestsPanel {...baseProps} />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(screen.getByText('requestsPanel.approve')).toBeInTheDocument();
    expect(screen.getByText('requestsPanel.deny')).toBeInTheDocument();
  });

  it('calls approve when approve button is clicked', async () => {
    const request = { messageUri: 'msg1', requesterWebId: 'https://req.example/card#me', accessTo: 'https://owner.example/files/', requestType: 'catalog' as const, timestamp: '' };
    hookReturnValue = { ...hookReturnValue, requests: [request] };
    render(<RequestsPanel {...baseProps} />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    await act(async () => {
      fireEvent.click(screen.getByText('requestsPanel.approve'));
    });
    expect(mockApprove).toHaveBeenCalledWith(request);
  });

  it('calls deny when deny button is clicked', async () => {
    const request = { messageUri: 'msg1', requesterWebId: 'https://req.example/card#me', accessTo: 'https://owner.example/files/', requestType: 'catalog' as const, timestamp: '' };
    hookReturnValue = { ...hookReturnValue, requests: [request] };
    render(<RequestsPanel {...baseProps} />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    await act(async () => {
      fireEvent.click(screen.getByText('requestsPanel.deny'));
    });
    expect(mockDeny).toHaveBeenCalledWith(request);
  });

  it('disables buttons when isBusy for that request', () => {
    const request = { messageUri: 'msg1', requesterWebId: 'https://req.example/card#me', accessTo: 'https://owner.example/files/', requestType: 'catalog' as const, timestamp: '' };
    hookReturnValue = { ...hookReturnValue, requests: [request], busyMessageUri: 'msg1' };
    render(<RequestsPanel {...baseProps} />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(screen.getByText('requestsPanel.approve')).toBeDisabled();
    expect(screen.getByText('requestsPanel.deny')).toBeDisabled();
  });

  it('renders refresh button when open and not loading', () => {
    render(<RequestsPanel {...baseProps} />);
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
    render(<RequestsPanel {...baseProps} />);
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
    render(<RequestsPanel {...baseProps} />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(screen.getByText('requestsPanel.requestsFileAccess:my doc.ttl')).toBeInTheDocument();
  });

  it('shows timestamp when provided', () => {
    hookReturnValue = {
      ...hookReturnValue,
      requests: [
        { messageUri: 'msg1', requesterWebId: 'https://req.example/card#me', accessTo: 'https://owner.example/', requestType: 'catalog', timestamp: '2025-03-15T10:00:00Z' },
      ],
    };
    render(<RequestsPanel {...baseProps} />);
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
    render(<RequestsPanel {...baseProps} />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(screen.getByTestId('avatar')).toBeInTheDocument();
    expect(document.querySelector('.requests-panel__requester-name')).toHaveTextContent('Requester');
  });

  it('collapses panel when toggle is clicked again', () => {
    render(<RequestsPanel {...baseProps} />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(document.querySelector('.requests-panel__body')).toBeInTheDocument();
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    expect(document.querySelector('.requests-panel__body')).not.toBeInTheDocument();
  });

  it('shows loading text in RequesterRow when contact resource is loading', () => {
    mockResourceLoading = true;
    hookReturnValue = {
      ...hookReturnValue,
      requests: [
        { messageUri: 'msg1', requesterWebId: 'https://req.example/card#me', accessTo: 'https://owner.example/', requestType: 'catalog', timestamp: '' },
      ],
    };
    render(<RequestsPanel {...baseProps} />);
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
    render(<RequestsPanel {...baseProps} />);
    fireEvent.click(screen.getByText('requestsPanel.heading'));
    const nameEl = document.querySelector('.requests-panel__requester-name');
    expect(nameEl?.textContent).toContain('…');
    expect(nameEl?.textContent?.length).toBeLessThanOrEqual(31); // 30 chars + ellipsis
  });
});

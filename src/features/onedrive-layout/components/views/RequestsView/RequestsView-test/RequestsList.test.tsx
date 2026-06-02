import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { AccessRequest } from '@/infrastructure/inbox/inboxAccess';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(_key: string, fallback?: string) => fallback ?? _key],
}));

const mockLoadRequests = vi.fn();
const mockApprove = vi.fn();
const mockDeny = vi.fn();
const mockMarkSeen = vi.fn();
const mockSelectRequest = vi.fn();
const mockIsSeen = vi.fn(() => false);
const mockMarkAllSeen = vi.fn();

const DEFAULTS = {
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

let contextValue: typeof DEFAULTS | null = { ...DEFAULTS };

vi.mock('@/features/profile/contexts/RequestNotificationsContext', () => ({
  useRequestNotifications: () => contextValue,
}));

let lastCardProps: Record<string, unknown> | undefined;
vi.mock('../RequestsView-file/RequestCard', () => ({
  RequestCard: (props: Record<string, unknown>) => {
    lastCardProps = props;
    const request = props.request as AccessRequest;
    return (
      <div
        data-testid="request-card"
        data-id={request.messageUri}
        data-busy={props.busy ? 'true' : 'false'}
        data-highlighted={props.highlighted ? 'true' : 'false'}
      />
    );
  },
}));

import { RequestsList } from '../RequestsView-file/RequestsList';

const renderList = () => render(<RequestsList />);

const makeRequest = (id: string): AccessRequest => ({
  messageUri: `urn:msg:${id}`,
  requesterWebId: `https://${id}.example/profile/card#me`,
  accessTo: 'https://owner.example/files/photo/',
  requestType: 'catalog',
  timestamp: '2026-04-22T10:00:00Z',
});

const setContext = (overrides: Partial<typeof DEFAULTS> = {}): void => {
  contextValue = { ...DEFAULTS, ...overrides };
};

describe('RequestsList', () => {
  beforeEach(() => {
    mockLoadRequests.mockReset();
    mockApprove.mockReset();
    mockDeny.mockReset();
    mockMarkSeen.mockReset();
    mockSelectRequest.mockReset();
    mockIsSeen.mockReset();
    mockIsSeen.mockReturnValue(false);
    setContext();
    lastCardProps = undefined;
  });

  it('renders a Refresh button', () => {
    renderList();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('shows a loading state when loading=true', () => {
    setContext({ loading: true });
    renderList();
    expect(screen.getByText('Loading requests…')).toBeInTheDocument();
    expect(screen.queryAllByTestId('request-card')).toHaveLength(0);
  });

  it('shows an error message when error is set', () => {
    setContext({ error: 'inbox unreachable' });
    renderList();
    expect(screen.getByText('inbox unreachable')).toBeInTheDocument();
  });

  it('shows the empty title + subtitle when there are no requests', () => {
    renderList();
    expect(screen.getByText('No pending requests')).toBeInTheDocument();
    expect(
      screen.getByText(/when someone asks for access/i),
    ).toBeInTheDocument();
  });

  it('renders one RequestCard per pending request', () => {
    setContext({ requests: [makeRequest('alice'), makeRequest('bob')] });
    renderList();
    const cards = screen.getAllByTestId('request-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].getAttribute('data-id')).toBe('urn:msg:alice');
    expect(cards[1].getAttribute('data-id')).toBe('urn:msg:bob');
  });

  it('flags the busy card when busyMessageUri matches its message', () => {
    setContext({
      requests: [makeRequest('alice'), makeRequest('bob')],
      busyMessageUri: 'urn:msg:alice',
    });
    renderList();
    const cards = screen.getAllByTestId('request-card');
    expect(cards[0].getAttribute('data-busy')).toBe('true');
    expect(cards[1].getAttribute('data-busy')).toBe('false');
  });

  it('forwards approve/deny callbacks down to each card', () => {
    setContext({ requests: [makeRequest('alice')] });
    renderList();
    expect(lastCardProps?.onApprove).toBe(mockApprove);
    expect(lastCardProps?.onDeny).toBe(mockDeny);
  });

  it('calls loadRequests when the Refresh button is clicked', () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(mockLoadRequests).toHaveBeenCalledTimes(1);
  });

  it('disables the Refresh button while loading', () => {
    setContext({ loading: true });
    renderList();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
  });

  it('marks every visible request as seen on mount', () => {
    setContext({ requests: [makeRequest('alice'), makeRequest('bob')] });
    renderList();
    expect(mockMarkSeen).toHaveBeenCalledWith(['urn:msg:alice', 'urn:msg:bob']);
  });

  it('does not call markSeen when there are no requests', () => {
    setContext({ requests: [] });
    renderList();
    expect(mockMarkSeen).not.toHaveBeenCalled();
  });

  it('flags the matching card as highlighted when selectedRequestId is set', () => {
    setContext({
      selectedRequestId: 'urn:msg:bob',
      requests: [makeRequest('alice'), makeRequest('bob')],
    });
    renderList();
    const cards = screen.getAllByTestId('request-card');
    expect(cards[0].getAttribute('data-highlighted')).toBe('false');
    expect(cards[1].getAttribute('data-highlighted')).toBe('true');
  });

  it('clears the selection when the Refresh button is clicked', () => {
    setContext({ selectedRequestId: 'urn:msg:alice' });
    renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(mockSelectRequest).toHaveBeenCalledWith(null);
    expect(mockLoadRequests).toHaveBeenCalledTimes(1);
  });

  it('renders no cards when context is absent', () => {
    contextValue = null;
    renderList();
    expect(screen.queryAllByTestId('request-card')).toHaveLength(0);
    expect(screen.getByText('No pending requests')).toBeInTheDocument();
  });
});

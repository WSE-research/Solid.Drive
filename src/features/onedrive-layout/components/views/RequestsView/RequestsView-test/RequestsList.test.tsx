import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { AccessRequest } from '@/infrastructure/inbox/inboxAccess';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(_key: string, fallback?: string) => fallback ?? _key],
}));

interface AccessRequestsState {
  requests: AccessRequest[];
  loading: boolean;
  error: string | null;
  busyMessageUri: string | null;
}

const mockState: { current: AccessRequestsState } = {
  current: {
    requests: [],
    loading: false,
    error: null,
    busyMessageUri: null,
  },
};

const mockLoadRequests = vi.fn();
const mockApprove = vi.fn();
const mockDeny = vi.fn();

vi.mock('@/features/profile/hooks/useAccessRequests', () => ({
  useAccessRequests: () => ({
    ...mockState.current,
    loadRequests: mockLoadRequests,
    approve: mockApprove,
    deny: mockDeny,
  }),
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
      />
    );
  },
}));

import { RequestsList } from '../RequestsView-file/RequestsList';

const renderList = () =>
  render(
    <RequestsList
      ownerWebId="https://owner.example/profile/card#me"
      storageRoot="https://owner.example/"
      catalogUri="https://owner.example/my-solid-app/catalog.ttl"
    />,
  );

const makeRequest = (id: string): AccessRequest => ({
  messageUri: `urn:msg:${id}`,
  requesterWebId: `https://${id}.example/profile/card#me`,
  accessTo: 'https://owner.example/files/photo/',
  requestType: 'catalog',
  timestamp: '2026-04-22T10:00:00Z',
});

describe('RequestsList', () => {
  beforeEach(() => {
    mockState.current = {
      requests: [],
      loading: false,
      error: null,
      busyMessageUri: null,
    };
    mockLoadRequests.mockReset();
    mockApprove.mockReset();
    mockDeny.mockReset();
    lastCardProps = undefined;
  });

  it('renders the heading and a Refresh button', () => {
    renderList();
    expect(screen.getByText('Pending requests')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('shows a loading state when loading=true', () => {
    mockState.current = { ...mockState.current, loading: true };
    renderList();
    expect(screen.getByText('Loading requests…')).toBeInTheDocument();
    expect(screen.queryAllByTestId('request-card')).toHaveLength(0);
  });

  it('shows an error message when error is set', () => {
    mockState.current = { ...mockState.current, error: 'inbox unreachable' };
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
    mockState.current = {
      ...mockState.current,
      requests: [makeRequest('alice'), makeRequest('bob')],
    };
    renderList();
    const cards = screen.getAllByTestId('request-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].getAttribute('data-id')).toBe('urn:msg:alice');
    expect(cards[1].getAttribute('data-id')).toBe('urn:msg:bob');
  });

  it('flags the busy card when busyMessageUri matches its message', () => {
    mockState.current = {
      ...mockState.current,
      requests: [makeRequest('alice'), makeRequest('bob')],
      busyMessageUri: 'urn:msg:alice',
    };
    renderList();
    const cards = screen.getAllByTestId('request-card');
    expect(cards[0].getAttribute('data-busy')).toBe('true');
    expect(cards[1].getAttribute('data-busy')).toBe('false');
  });

  it('forwards approve/deny callbacks down to each card', () => {
    mockState.current = {
      ...mockState.current,
      requests: [makeRequest('alice')],
    };
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
    mockState.current = { ...mockState.current, loading: true };
    renderList();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
  });
});

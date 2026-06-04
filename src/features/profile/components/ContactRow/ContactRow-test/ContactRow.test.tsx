import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { RequestStatus } from '@/shared/hooks/usePendingRequests';

vi.mock('react-i18next', () => ({ useTranslation: () => [(key: string) => key] }));

vi.mock('@/config', () => ({ MAX_DISPLAY_NAME_LENGTH: 30 }));

vi.mock('@/shared/components/Avatar', () => ({
  Avatar: ({ alt }: { alt: string }) => <div data-testid="avatar">{alt}</div>,
}));

let mockProfile = { displayName: 'Alice', avatarUrl: undefined as string | undefined, initial: 'A', isLoading: false };
vi.mock('@/shared/hooks/useContactProfile', () => ({
  useContactProfile: () => mockProfile,
}));

let mockStatus: RequestStatus = 'none';
const mockClearPending = vi.fn();
vi.mock('@/shared/hooks/usePendingRequests', () => ({
  usePendingRequests: () => ({ isPending: () => false, markPending: vi.fn(), clearPending: mockClearPending }),
  useRequestStatus: () => mockStatus,
}));

const mockDiscoverInboxUri = vi.fn();
const mockPostCatalogAccessRequest = vi.fn();
const mockDeleteAccessRequest = vi.fn();
vi.mock('@/infrastructure/inbox/inboxAccess', () => ({
  discoverInboxUri: (...args: unknown[]) => mockDiscoverInboxUri(...args),
  postCatalogAccessRequest: (...args: unknown[]) => mockPostCatalogAccessRequest(...args),
  deleteAccessRequest: (...args: unknown[]) => mockDeleteAccessRequest(...args),
}));

import { ContactRow } from '../ContactRow-file/ContactRow';

const solidFetch = vi.fn();
const onClearOutcome = vi.fn();
const onRemove = vi.fn();
const baseProps = {
  webId: 'https://alice.example/profile/card#me',
  ownerWebId: 'https://owner.example/profile/card#me',
  solidFetch,
  approval: undefined,
  rejection: undefined,
  onClearOutcome,
  onRemove,
};
const rejection = { accessTo: baseProps.webId, messageUri: 'https://owner.example/inbox/rej1' };
const approval = { accessTo: baseProps.webId, messageUri: 'https://owner.example/inbox/app1' };

beforeEach(() => {
  vi.clearAllMocks();
  mockStatus = 'none';
  mockProfile = { displayName: 'Alice', avatarUrl: undefined, initial: 'A', isLoading: false };
  mockDiscoverInboxUri.mockResolvedValue('https://alice.example/inbox/');
  mockPostCatalogAccessRequest.mockResolvedValue(undefined);
  mockDeleteAccessRequest.mockResolvedValue(undefined);
});

describe('ContactRow', () => {
  it('renders the contact name and avatar', () => {
    render(<ContactRow {...baseProps} />);
    expect(document.querySelector('.contact-row__name')).toHaveTextContent('Alice');
    expect(screen.getByTestId('avatar')).toBeInTheDocument();
  });

  it('renders the request access button when idle', () => {
    render(<ContactRow {...baseProps} />);
    expect(screen.getByText('profileSidebar.requestAccess')).toBeInTheDocument();
  });

  it('calls onRemove when remove is clicked', () => {
    render(<ContactRow {...baseProps} />);
    fireEvent.click(screen.getByText('profileSidebar.remove'));
    expect(onRemove).toHaveBeenCalled();
  });

  it('sends the catalog request when the button is clicked', async () => {
    render(<ContactRow {...baseProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText('profileSidebar.requestAccess'));
    });
    expect(mockDiscoverInboxUri).toHaveBeenCalledWith(baseProps.webId, solidFetch);
    expect(mockPostCatalogAccessRequest).toHaveBeenCalled();
  });

  it('shows the pending pill when the request is pending', () => {
    mockStatus = 'pending';
    render(<ContactRow {...baseProps} />);
    expect(screen.getByText('profileSidebar.requestPending')).toBeInTheDocument();
    expect(screen.queryByText('profileSidebar.requestAccess')).not.toBeInTheDocument();
  });

  it('shows the approved pill and a request-again action when approved', () => {
    mockStatus = 'approved';
    render(<ContactRow {...baseProps} approval={approval} />);
    expect(screen.getByText('profileSidebar.requestApproved')).toBeInTheDocument();
    expect(screen.getByText('profileSidebar.requestAgain')).toBeInTheDocument();
  });

  it('shows the denied pill and a request-again action when denied', () => {
    mockStatus = 'denied';
    render(<ContactRow {...baseProps} rejection={rejection} />);
    expect(screen.getByText('profileSidebar.requestDenied')).toBeInTheDocument();
    expect(screen.getByText('profileSidebar.requestAgain')).toBeInTheDocument();
  });

  it('request again deletes the prior outcome notice and re-posts (the loop)', async () => {
    mockStatus = 'approved';
    render(<ContactRow {...baseProps} approval={approval} />);
    await act(async () => {
      fireEvent.click(screen.getByText('profileSidebar.requestAgain'));
    });
    expect(mockDeleteAccessRequest).toHaveBeenCalledWith(approval.messageUri, solidFetch);
    expect(onClearOutcome).toHaveBeenCalled();
    expect(mockPostCatalogAccessRequest).toHaveBeenCalled();
  });

  it('shows the retry label after a failed request', async () => {
    mockPostCatalogAccessRequest.mockRejectedValueOnce(new Error('fail'));
    render(<ContactRow {...baseProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText('profileSidebar.requestAccess'));
    });
    expect(screen.getByText('profileSidebar.requestError')).toBeInTheDocument();
  });

  it('truncates long display names', () => {
    mockProfile = { ...mockProfile, displayName: 'A'.repeat(40) };
    render(<ContactRow {...baseProps} />);
    expect(document.querySelector('.contact-row__name')?.textContent).toContain('...');
  });
});

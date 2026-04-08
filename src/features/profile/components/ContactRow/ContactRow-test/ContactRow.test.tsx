import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ContactRow } from '../ContactRow-file/ContactRow';
import { getProfileDisplayName } from '@/shared/utils';

const mockDiscoverInboxUri = vi.fn();
const mockPostCatalogAccessRequest = vi.fn();
const mockDeleteAccessRequest = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

let mockResourceLoading = false;

vi.mock('@ldo/solid-react', () => ({
  useResource: () => ({ isLoading: () => mockResourceLoading, isFetched: () => true, isUnfetched: () => false }),
  useSubject: () => ({
    name: 'Alice',
    fn: null,
    img: { '@id': 'https://alice.example/avatar.jpg' },
  }),
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({
  SolidProfileShapeType: {},
}));

vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isLoadable: () => true,
}));

vi.mock('@/infrastructure/inbox/inboxAccess', () => ({
  discoverInboxUri: (...args: any[]) => mockDiscoverInboxUri(...args),
  postCatalogAccessRequest: (...args: any[]) => mockPostCatalogAccessRequest(...args),
  deleteAccessRequest: (...args: any[]) => mockDeleteAccessRequest(...args),
}));

vi.mock('@/config', () => ({
  MAX_DISPLAY_NAME_LENGTH: 30,
}));

vi.mock('@/shared/components/Avatar', () => ({
  Avatar: ({ alt }: any) => <div data-testid="avatar">{alt}</div>,
}));

vi.mock('@/shared/utils', () => ({
  getInitial: (name: string) => name.charAt(0).toUpperCase(),
  getProfileDisplayName: vi.fn((contact: any, webId: string) => contact?.name ?? webId),
}));

const solidFetch = vi.fn();
const onClearRejection = vi.fn();
const onRemove = vi.fn();

const baseProps = {
  webId: 'https://alice.example/profile/card#me',
  ownerWebId: 'https://owner.example/profile/card#me',
  solidFetch,
  rejection: undefined as any,
  onClearRejection,
  onRemove,
};

describe('ContactRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResourceLoading = false;
    mockDiscoverInboxUri.mockResolvedValue('https://alice.example/inbox/');
    mockPostCatalogAccessRequest.mockResolvedValue(undefined);
    mockDeleteAccessRequest.mockResolvedValue(undefined);
  });

  it('renders contact name and avatar', () => {
    render(<ContactRow {...baseProps} />);
    expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('avatar')).toBeInTheDocument();
    expect(document.querySelector('.contact-row__name')).toHaveTextContent('Alice');
  });

  it('renders request access button', () => {
    render(<ContactRow {...baseProps} />);
    expect(screen.getByText('profileSidebar.requestAccess')).toBeInTheDocument();
  });

  it('renders remove button', () => {
    render(<ContactRow {...baseProps} />);
    expect(screen.getByText('profileSidebar.remove')).toBeInTheDocument();
  });

  it('calls onRemove when remove is clicked', () => {
    render(<ContactRow {...baseProps} />);
    fireEvent.click(screen.getByText('profileSidebar.remove'));
    expect(onRemove).toHaveBeenCalled();
  });

  it('sends access request when button is clicked', async () => {
    render(<ContactRow {...baseProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText('profileSidebar.requestAccess'));
    });
    expect(mockDiscoverInboxUri).toHaveBeenCalledWith('https://alice.example/profile/card#me', solidFetch);
    expect(mockPostCatalogAccessRequest).toHaveBeenCalled();
  });

  it('shows "request sent" after successful request', async () => {
    render(<ContactRow {...baseProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText('profileSidebar.requestAccess'));
    });
    expect(screen.getByText('profileSidebar.requestSent')).toBeInTheDocument();
    expect(screen.getByText('profileSidebar.requestSent')).toBeDisabled();
  });

  it('shows error text when request fails', async () => {
    mockDiscoverInboxUri.mockRejectedValue(new Error('fail'));
    render(<ContactRow {...baseProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText('profileSidebar.requestAccess'));
    });
    expect(screen.getByText('profileSidebar.requestError')).toBeInTheDocument();
  });

  it('shows rejection badge when rejection is present', () => {
    render(
      <ContactRow
        {...baseProps}
        rejection={{ accessTo: baseProps.webId, messageUri: 'https://owner.example/inbox/rej1', sender: baseProps.webId }}
      />
    );
    expect(screen.getByText('profileSidebar.requestDenied')).toBeInTheDocument();
    expect(screen.getByText('profileSidebar.requestAgain')).toBeInTheDocument();
  });

  it('request again deletes old rejection and re-sends request', async () => {
    render(
      <ContactRow
        {...baseProps}
        rejection={{ accessTo: baseProps.webId, messageUri: 'https://owner.example/inbox/rej1', sender: baseProps.webId }}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByText('profileSidebar.requestAgain'));
    });
    expect(mockDeleteAccessRequest).toHaveBeenCalledWith('https://owner.example/inbox/rej1', solidFetch);
    expect(onClearRejection).toHaveBeenCalled();
  });

  it('request again continues even when deleteAccessRequest fails', async () => {
    mockDeleteAccessRequest.mockRejectedValue(new Error('cleanup fail'));
    render(
      <ContactRow
        {...baseProps}
        rejection={{ accessTo: baseProps.webId, messageUri: 'https://owner.example/inbox/rej1', sender: baseProps.webId }}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByText('profileSidebar.requestAgain'));
    });
    // Should still proceed with clearing rejection and re-requesting
    expect(onClearRejection).toHaveBeenCalled();
  });

  it('truncates long display names', () => {
    // MAX_DISPLAY_NAME_LENGTH is mocked as 30
    vi.mocked(getProfileDisplayName).mockReturnValue('A'.repeat(40));
    render(<ContactRow {...baseProps} />);
    const nameEl = document.querySelector('.contact-row__name');
    expect(nameEl?.textContent).toContain('...');
    // Restore default mock
    vi.mocked(getProfileDisplayName).mockImplementation((contact: any, webId: string) => contact?.name ?? webId);
  });

  it('shows "sending" state while request is in progress', async () => {
    // Make discoverInboxUri hang so the request stays in "sending" state
    let resolveInbox: any;
    mockDiscoverInboxUri.mockReturnValue(new Promise((r) => { resolveInbox = r; }));
    render(<ContactRow {...baseProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText('profileSidebar.requestAccess'));
    });
    expect(screen.getByText('...')).toBeInTheDocument();
    // Cleanup
    resolveInbox('https://alice.example/inbox/');
  });

  it('shows loading text when resource is loading', () => {
    mockResourceLoading = true;
    render(<ContactRow {...baseProps} />);
    const nameEl = document.querySelector('.contact-row__name');
    expect(nameEl?.textContent).toBe('profileSidebar.loading');
  });
});

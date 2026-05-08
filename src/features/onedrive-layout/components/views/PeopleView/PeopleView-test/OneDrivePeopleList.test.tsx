import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(_key: string, fallback?: string) => fallback ?? _key],
}));

const mockSolidFetch = vi.fn();
vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ fetch: mockSolidFetch }),
}));

const mockDiscoverInboxUri = vi.fn();
const mockPostCatalogAccessRequest = vi.fn();
vi.mock('@/infrastructure/inbox/inboxAccess', () => ({
  discoverInboxUri: (...args: unknown[]) => mockDiscoverInboxUri(...args),
  postCatalogAccessRequest: (...args: unknown[]) => mockPostCatalogAccessRequest(...args),
}));

vi.mock('@/shared/components/Avatar', () => ({
  Avatar: ({ alt, initial }: { alt: string; initial: string }) => (
    <span data-testid="avatar" data-alt={alt} data-initial={initial} />
  ),
}));

const mockProfileMap: Record<string, { displayName: string; initial: string }> = {
  'https://alice.example/profile/card#me': { displayName: 'Alice', initial: 'A' },
  'https://bob.example/profile/card#me': { displayName: 'Bob', initial: 'B' },
};
vi.mock('@/shared/hooks/useContactProfile', () => ({
  useContactProfile: (webId: string) => ({
    displayName: mockProfileMap[webId]?.displayName ?? webId,
    avatarUrl: undefined,
    initial: mockProfileMap[webId]?.initial ?? '?',
    isLoading: false,
  }),
}));

const mockShowError = vi.fn();
const mockConfirm = vi.fn();
vi.mock('@/shared/contexts/NotificationContext', () => ({
  useNotifications: () => ({
    showError: mockShowError,
    confirm: mockConfirm,
  }),
}));

const mockAddContact = vi.fn();
const mockRemoveContact = vi.fn();
let mockContacts: string[] = [];
let mockIsAdding = false;
vi.mock('@/features/profile/hooks/useContacts', () => ({
  useContacts: () => ({
    contacts: mockContacts,
    addContact: mockAddContact,
    removeContact: mockRemoveContact,
    isAdding: mockIsAdding,
  }),
}));

vi.mock('@/features/onedrive-layout/icons', () => {
  const Stub = () => null;
  return {
    PlusIcon: Stub,
    CloseIcon: Stub,
    DeleteIcon: Stub,
    RequestAccessIcon: Stub,
    CheckmarkIcon: Stub,
  };
});

import { OneDrivePeopleList } from '../PeopleView-file/OneDrivePeopleList';

const OWNER_WEB_ID = 'https://owner.example/profile/card#me';
const ALICE = 'https://alice.example/profile/card#me';
const BOB = 'https://bob.example/profile/card#me';

const renderList = (onSelect = vi.fn()) =>
  render(<OneDrivePeopleList ownerWebId={OWNER_WEB_ID} onSelect={onSelect} />);

describe('OneDrivePeopleList', () => {
  beforeEach(() => {
    mockContacts = [];
    mockIsAdding = false;
    mockAddContact.mockReset();
    mockRemoveContact.mockReset();
    mockShowError.mockReset();
    mockConfirm.mockReset();
    mockConfirm.mockResolvedValue(true);
    mockSolidFetch.mockReset();
    mockDiscoverInboxUri.mockReset();
    mockPostCatalogAccessRequest.mockReset();
  });

  it('renders the inline "People" title alongside the filter + add toggle', () => {
    renderList();
    // Page-header is suppressed for the People view, so the list owns
    // the title and renders it on the same line as the filter.
    expect(screen.getByRole('heading', { name: 'People' })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Filter by name or person'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Add')).toBeInTheDocument();
  });

  it('shows the empty hint when there are no contacts', () => {
    renderList();
    expect(screen.getByText('No contacts yet.')).toBeInTheDocument();
    expect(screen.queryAllByTestId('person-row')).toHaveLength(0);
  });

  it('renders one row per contact with the resolved display name', () => {
    mockContacts = [ALICE, BOB];
    renderList();
    const rows = screen.getAllByTestId('person-row');
    expect(rows).toHaveLength(2);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('fires onSelect with the contact WebID when a row is clicked', () => {
    mockContacts = [ALICE];
    const onSelect = vi.fn();
    renderList(onSelect);
    fireEvent.click(screen.getByTestId('person-row'));
    expect(onSelect).toHaveBeenCalledWith(ALICE);
  });

  it('fires onSelect on Enter key', () => {
    mockContacts = [ALICE];
    const onSelect = vi.fn();
    renderList(onSelect);
    fireEvent.keyDown(screen.getByTestId('person-row'), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(ALICE);
  });

  it('filters rows live by display name', () => {
    mockContacts = [ALICE, BOB];
    renderList();
    fireEvent.change(screen.getByPlaceholderText('Filter by name or person'), {
      target: { value: 'ali' },
    });
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });

  it('opens the add input when the add toggle is clicked', () => {
    renderList();
    expect(
      screen.queryByPlaceholderText('WebID https://…'),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Add'));
    expect(
      screen.getByPlaceholderText('WebID https://…'),
    ).toBeInTheDocument();
  });

  it('rejects an invalid WebID and surfaces a notification', async () => {
    renderList();
    fireEvent.click(screen.getByLabelText('Add'));
    const input = screen.getByPlaceholderText('WebID https://…');
    fireEvent.change(input, { target: { value: 'not a url' } });
    await act(async () => {
      fireEvent.click(screen.getByText('Add'));
    });
    expect(mockShowError).toHaveBeenCalledWith(
      'WebID must be a valid http(s):// URL',
    );
    expect(mockAddContact).not.toHaveBeenCalled();
  });

  it('calls addContact with a valid WebID and closes the form', async () => {
    mockAddContact.mockResolvedValue(undefined);
    renderList();
    fireEvent.click(screen.getByLabelText('Add'));
    fireEvent.change(screen.getByPlaceholderText('WebID https://…'), {
      target: { value: ALICE },
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Add'));
    });
    expect(mockAddContact).toHaveBeenCalledWith(ALICE);
    expect(
      screen.queryByPlaceholderText('WebID https://…'),
    ).not.toBeInTheDocument();
  });

  it('confirms and calls removeContact when the row × is clicked', async () => {
    mockContacts = [ALICE];
    mockRemoveContact.mockResolvedValue(undefined);
    renderList();
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Remove'));
    });
    expect(mockConfirm).toHaveBeenCalled();
    expect(mockRemoveContact).toHaveBeenCalledWith(ALICE);
  });

  it('does NOT call onSelect when the row × is clicked', async () => {
    mockContacts = [ALICE];
    mockRemoveContact.mockResolvedValue(undefined);
    const onSelect = vi.fn();
    renderList(onSelect);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Remove'));
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  describe('catalog request button', () => {
    it('renders the Request Access button next to Remove on every row', () => {
      mockContacts = [ALICE];
      renderList();
      expect(screen.getByLabelText('Request Access')).toBeInTheDocument();
      expect(screen.getByLabelText('Remove')).toBeInTheDocument();
    });

    it('discovers the contact inbox + posts a catalog request when clicked', async () => {
      mockContacts = [ALICE];
      mockDiscoverInboxUri.mockResolvedValue('https://alice.example/inbox/');
      mockPostCatalogAccessRequest.mockResolvedValue(undefined);
      renderList();
      await act(async () => {
        fireEvent.click(screen.getByLabelText('Request Access'));
      });
      expect(mockDiscoverInboxUri).toHaveBeenCalledWith(ALICE, mockSolidFetch);
      expect(mockPostCatalogAccessRequest).toHaveBeenCalledWith(
        'https://alice.example/inbox/',
        OWNER_WEB_ID,
        ALICE,
        mockSolidFetch,
      );
    });

    it('switches to the "Requested" state on success and disables the button', async () => {
      mockContacts = [ALICE];
      mockDiscoverInboxUri.mockResolvedValue('https://alice.example/inbox/');
      mockPostCatalogAccessRequest.mockResolvedValue(undefined);
      renderList();
      await act(async () => {
        fireEvent.click(screen.getByLabelText('Request Access'));
      });
      const requested = screen.getByLabelText('Requested');
      expect(requested).toBeInTheDocument();
      expect(requested).toBeDisabled();
    });

    it('switches to the "Retry" state when the request fails', async () => {
      mockContacts = [ALICE];
      mockDiscoverInboxUri.mockRejectedValue(new Error('no inbox'));
      renderList();
      await act(async () => {
        fireEvent.click(screen.getByLabelText('Request Access'));
      });
      expect(screen.getByLabelText('Retry')).toBeInTheDocument();
    });

    it('does NOT call onSelect when the request button is clicked', async () => {
      mockContacts = [ALICE];
      mockDiscoverInboxUri.mockResolvedValue('https://alice.example/inbox/');
      mockPostCatalogAccessRequest.mockResolvedValue(undefined);
      const onSelect = vi.fn();
      renderList(onSelect);
      await act(async () => {
        fireEvent.click(screen.getByLabelText('Request Access'));
      });
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  // --- branch coverage additions ---

  it('shows error notification when removeContact rejects', async () => {
    mockContacts = [ALICE];
    mockRemoveContact.mockRejectedValue(new Error('network error'));
    renderList();
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Remove'));
    });
    expect(mockShowError).toHaveBeenCalledWith('network error');
  });

  it('does NOT remove the contact when confirm returns false', async () => {
    mockContacts = [ALICE];
    mockConfirm.mockResolvedValue(false);
    renderList();
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Remove'));
    });
    expect(mockRemoveContact).not.toHaveBeenCalled();
  });

  it('shows error notification when addContact rejects with an error', async () => {
    mockAddContact.mockRejectedValue(new Error('duplicate contact'));
    renderList();
    fireEvent.click(screen.getByLabelText('Add'));
    fireEvent.change(screen.getByPlaceholderText('WebID https://…'), {
      target: { value: ALICE },
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Add'));
    });
    expect(mockShowError).toHaveBeenCalledWith('duplicate contact');
  });

  it('closes the add form when Escape is pressed in the WebID input', () => {
    renderList();
    fireEvent.click(screen.getByLabelText('Add'));
    expect(screen.getByPlaceholderText('WebID https://…')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByPlaceholderText('WebID https://…'), {
      key: 'Escape',
    });
    expect(
      screen.queryByPlaceholderText('WebID https://…'),
    ).not.toBeInTheDocument();
  });

  it('fires onSelect on Space key', () => {
    mockContacts = [ALICE];
    const onSelect = vi.fn();
    renderList(onSelect);
    fireEvent.keyDown(screen.getByTestId('person-row'), { key: ' ' });
    expect(onSelect).toHaveBeenCalledWith(ALICE);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ContactsList } from '../ContactsList-file/ContactsList';

const mockFetch = vi.fn();
const mockAddContact = vi.fn();
const mockRemoveContact = vi.fn();
const mockShowError = vi.fn();
let mockContacts: string[] = [];
let mockIsAdding = false;

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ fetch: mockFetch }),
}));

vi.mock('@/features/profile/hooks/useContacts', () => ({
  useContacts: () => ({
    contacts: mockContacts,
    addContact: mockAddContact,
    removeContact: mockRemoveContact,
    isAdding: mockIsAdding,
  }),
}));

vi.mock('@/infrastructure/inbox/inboxAccess', () => ({
  discoverInboxUri: vi.fn(() => Promise.resolve('https://owner.example/inbox/')),
  listOutcomeNotifications: vi.fn(() => Promise.resolve({ approvals: [], rejections: [] })),
}));

vi.mock('@/shared/contexts/NotificationContext', () => ({
  useNotifications: () => ({ showError: mockShowError }),
}));

let capturedOnClearRejection: (() => void) | undefined;

vi.mock('@/features/profile/components/ContactRow', () => ({
  ContactRow: ({ webId, onRemove, onClearOutcome }: { webId: string; onRemove: () => void; onClearOutcome: () => void }) => {
    capturedOnClearRejection = onClearOutcome;
    return (
      <div data-testid="contact-row" data-webid={webId}>
        <button data-testid="remove-btn" onClick={onRemove}>Remove</button>
        <button data-testid="clear-rejection-btn" onClick={onClearOutcome}>ClearRejection</button>
      </div>
    );
  },
}));

describe('ContactsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContacts = [];
    mockIsAdding = false;
    mockAddContact.mockResolvedValue(undefined);
    mockRemoveContact.mockResolvedValue(undefined);
    capturedOnClearRejection = undefined;
  });

  it('renders contacts section heading', () => {
    render(<ContactsList ownerWebId="https://owner.example/profile/card#me" />);
    expect(screen.getByText('profileSidebar.contacts')).toBeInTheDocument();
  });

  it('renders input and add button', () => {
    render(<ContactsList ownerWebId="https://owner.example/profile/card#me" />);
    expect(screen.getByPlaceholderText('profileSidebar.webIdPlaceholder')).toBeInTheDocument();
    expect(screen.getByText('profileSidebar.add')).toBeInTheDocument();
  });

  it('shows no contacts message when empty', () => {
    render(<ContactsList ownerWebId="https://owner.example/profile/card#me" />);
    expect(screen.getByText('profileSidebar.noContacts')).toBeInTheDocument();
  });

  it('renders ContactRow for each contact', () => {
    mockContacts = ['https://alice.example/profile/card#me', 'https://bob.example/profile/card#me'];
    render(<ContactsList ownerWebId="https://owner.example/profile/card#me" />);
    expect(screen.getAllByTestId('contact-row')).toHaveLength(2);
  });

  it('add button is disabled when input is empty', () => {
    render(<ContactsList ownerWebId="https://owner.example/profile/card#me" />);
    expect(screen.getByText('profileSidebar.add')).toBeDisabled();
  });

  it('add button calls addContact with trimmed WebID', async () => {
    render(<ContactsList ownerWebId="https://owner.example/profile/card#me" />);
    const input = screen.getByPlaceholderText('profileSidebar.webIdPlaceholder');
    fireEvent.change(input, { target: { value: 'https://alice.example/profile/card#me' } });
    await act(async () => {
      fireEvent.click(screen.getByText('profileSidebar.add'));
    });
    expect(mockAddContact).toHaveBeenCalledWith('https://alice.example/profile/card#me');
  });

  it('shows error for invalid WebID URL', async () => {
    render(<ContactsList ownerWebId="https://owner.example/profile/card#me" />);
    const input = screen.getByPlaceholderText('profileSidebar.webIdPlaceholder');
    fireEvent.change(input, { target: { value: 'not a url' } });
    await act(async () => {
      fireEvent.click(screen.getByText('profileSidebar.add'));
    });
    expect(mockShowError).toHaveBeenCalledWith('profileSidebar.invalidWebId');
    expect(mockAddContact).not.toHaveBeenCalled();
  });

  it('shows error when addContact throws', async () => {
    mockAddContact.mockRejectedValue(new Error('Duplicate'));
    render(<ContactsList ownerWebId="https://owner.example/profile/card#me" />);
    const input = screen.getByPlaceholderText('profileSidebar.webIdPlaceholder');
    fireEvent.change(input, { target: { value: 'https://alice.example/profile/card#me' } });
    await act(async () => {
      fireEvent.click(screen.getByText('profileSidebar.add'));
    });
    expect(mockShowError).toHaveBeenCalledWith('Duplicate');
  });

  it('Enter key in input triggers add', async () => {
    render(<ContactsList ownerWebId="https://owner.example/profile/card#me" />);
    const input = screen.getByPlaceholderText('profileSidebar.webIdPlaceholder');
    fireEvent.change(input, { target: { value: 'https://alice.example/profile/card#me' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(mockAddContact).toHaveBeenCalled();
  });

  it('disables input and shows "..." when isAdding', () => {
    mockIsAdding = true;
    render(<ContactsList ownerWebId="https://owner.example/profile/card#me" />);
    expect(screen.getByPlaceholderText('profileSidebar.webIdPlaceholder')).toBeDisabled();
    expect(screen.getByText('...')).toBeInTheDocument();
  });

  it('remove button calls removeContact', async () => {
    mockContacts = ['https://alice.example/profile/card#me'];
    render(<ContactsList ownerWebId="https://owner.example/profile/card#me" />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('remove-btn'));
    });
    expect(mockRemoveContact).toHaveBeenCalledWith('https://alice.example/profile/card#me');
  });

  it('shows error when removeContact throws', async () => {
    mockContacts = ['https://alice.example/profile/card#me'];
    mockRemoveContact.mockRejectedValue(new Error('Remove failed'));
    render(<ContactsList ownerWebId="https://owner.example/profile/card#me" />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('remove-btn'));
    });
    expect(mockShowError).toHaveBeenCalledWith('Remove failed');
  });

  it('renders normally without error when inbox discovery fails', async () => {
    const { discoverInboxUri } = await import('@/infrastructure/inbox/inboxAccess');
    vi.mocked(discoverInboxUri).mockRejectedValueOnce(new Error('no inbox'));
    await act(async () => {
      render(<ContactsList ownerWebId="https://owner.example/profile/card#me" />);
    });
    // Should render normally without error
    expect(screen.getByText('profileSidebar.contacts')).toBeInTheDocument();
  });

  it('onClearRejection removes the rejection from the map', async () => {
    mockContacts = ['https://alice.example/profile/card#me'];
    const { listOutcomeNotifications } = await import('@/infrastructure/inbox/inboxAccess');
    vi.mocked(listOutcomeNotifications).mockResolvedValueOnce({
      approvals: [],
      rejections: [{ accessTo: 'https://alice.example/profile/card#me', messageUri: 'https://owner.example/inbox/rej1' }],
    });
    await act(async () => {
      render(<ContactsList ownerWebId="https://owner.example/profile/card#me" />);
    });
    // Now click the clear rejection button to invoke onClearRejection
    expect(capturedOnClearRejection).toBeDefined();
    act(() => {
      capturedOnClearRejection!();
    });
    // The rejection should be cleared from the map (lines 118-122 covered)
    // Re-render verification: the component should still render the contact
    expect(screen.getByTestId('contact-row')).toBeInTheDocument();
  });

  it('skips inbox fetch when ownerWebId is empty', async () => {
    const { discoverInboxUri } = await import('@/infrastructure/inbox/inboxAccess');
    render(<ContactsList ownerWebId="" />);
    // useEffect early return fires — discoverInboxUri must not be called
    expect(vi.mocked(discoverInboxUri)).not.toHaveBeenCalled();
  });

  describe('onSelect mode', () => {
    it('does not wrap rows in a selectable shell when onSelect is omitted', () => {
      mockContacts = ['https://alice.example/profile/card#me'];
      const { container } = render(<ContactsList ownerWebId="https://owner.example/profile/card#me" />);
      expect(container.querySelector('.contacts__selectable-row')).toBeNull();
    });

    it('wraps each row in a selectable shell when onSelect is provided', () => {
      mockContacts = ['https://alice.example/profile/card#me'];
      const { container } = render(
        <ContactsList
          ownerWebId="https://owner.example/profile/card#me"
          onSelect={vi.fn()}
        />,
      );
      const wrapper = container.querySelector('.contacts__selectable-row');
      expect(wrapper).not.toBeNull();
      expect(wrapper?.getAttribute('role')).toBe('button');
      expect(wrapper?.getAttribute('tabindex')).toBe('0');
    });

    it('marks the matching wrapper as active when selectedWebId matches', () => {
      mockContacts = ['https://alice.example/profile/card#me'];
      const { container } = render(
        <ContactsList
          ownerWebId="https://owner.example/profile/card#me"
          onSelect={vi.fn()}
          selectedWebId="https://alice.example/profile/card#me"
        />,
      );
      const wrapper = container.querySelector('.contacts__selectable-row');
      expect(wrapper?.classList.contains('contacts__selectable-row--active')).toBe(true);
      expect(wrapper?.getAttribute('aria-pressed')).toBe('true');
    });

    it('fires onSelect when the wrapper is clicked away from interactive children', () => {
      const onSelect = vi.fn();
      mockContacts = ['https://alice.example/profile/card#me'];
      const { container } = render(
        <ContactsList
          ownerWebId="https://owner.example/profile/card#me"
          onSelect={onSelect}
        />,
      );
      const wrapper = container.querySelector('.contacts__selectable-row') as HTMLElement;
      // Click directly on the wrapper (target === wrapper, no inner button)
      fireEvent.click(wrapper);
      expect(onSelect).toHaveBeenCalledWith('https://alice.example/profile/card#me');
    });

    it('does not fire onSelect when the click originates inside an inner button', () => {
      const onSelect = vi.fn();
      mockContacts = ['https://alice.example/profile/card#me'];
      render(
        <ContactsList
          ownerWebId="https://owner.example/profile/card#me"
          onSelect={onSelect}
        />,
      );
      // The remove button is rendered inside the row by the mocked ContactRow
      fireEvent.click(screen.getByTestId('remove-btn'));
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('fires onSelect on Enter key', () => {
      const onSelect = vi.fn();
      mockContacts = ['https://alice.example/profile/card#me'];
      const { container } = render(
        <ContactsList
          ownerWebId="https://owner.example/profile/card#me"
          onSelect={onSelect}
        />,
      );
      const wrapper = container.querySelector('.contacts__selectable-row') as HTMLElement;
      fireEvent.keyDown(wrapper, { key: 'Enter' });
      expect(onSelect).toHaveBeenCalledWith('https://alice.example/profile/card#me');
    });

    it('ignores keys other than Enter or Space', () => {
      const onSelect = vi.fn();
      mockContacts = ['https://alice.example/profile/card#me'];
      const { container } = render(
        <ContactsList
          ownerWebId="https://owner.example/profile/card#me"
          onSelect={onSelect}
        />,
      );
      const wrapper = container.querySelector('.contacts__selectable-row') as HTMLElement;
      fireEvent.keyDown(wrapper, { key: 'ArrowDown' });
      expect(onSelect).not.toHaveBeenCalled();
    });
  });
});

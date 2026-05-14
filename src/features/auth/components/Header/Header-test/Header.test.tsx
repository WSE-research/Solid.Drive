import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '../Header-file/Header';

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: vi.fn(),
  useResource: vi.fn(() => null),
  useSubject: vi.fn(() => null),
}));

vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isLoadable: vi.fn(() => false),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

vi.mock('@/features/auth/components/LanguageSwitcher/LanguageSwitcher-file/LanguageSwitcher', () => ({
  LanguageSwitcher: () => null,
}));

import { useSolidAuth, useResource, useSubject } from '@ldo/solid-react';
import { isLoadable } from '@/infrastructure/solid/resourceGuards';
import { EXTERNAL_LINKS, SOLID_PROVIDERS } from '@/config';

const mockLogin = vi.fn();
const mockLogout = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isLoadable).mockReturnValue(false);
  vi.mocked(useResource).mockReturnValue(null);
  vi.mocked(useSubject).mockReturnValue(null);
});

describe('Header — logged out', () => {
  beforeEach(() => {
    vi.mocked(useSolidAuth).mockReturnValue({
      session: { isLoggedIn: false, webId: undefined },
      login: mockLogin,
      logout: mockLogout,
    });
  });

  it('renders the brand name', () => {
    render(<Header />);
    expect(screen.getByText(/solid/i, { selector: 'site-header-brand' })).toBeInTheDocument();
  });

  it('renders the provider select dropdown', () => {
    render(<Header />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders the login button', () => {
    render(<Header />);
    expect(screen.getByRole('button', { name: 'header.logIn' })).toBeInTheDocument();
  });

  it('disables the login button when no provider is selected', () => {
    render(<Header />);
    expect(screen.getByRole('button', { name: 'header.logIn' })).toBeDisabled();
  });

  it('enables the login button after a provider is selected', () => {
    render(<Header />);
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'https://solidcommunity.net' },
    });
    expect(screen.getByRole('button', { name: 'header.logIn' })).not.toBeDisabled();
  });

  it('calls login with the selected provider URL when clicked', () => {
    render(<Header />);
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'https://solidcommunity.net' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'header.logIn' }));
    expect(mockLogin).toHaveBeenCalledWith('https://solidcommunity.net');
  });

  it('shows a custom URL input when "Custom…" is selected', () => {
    render(<Header />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'custom' } });
    expect(screen.getByPlaceholderText('header.customProviderPlaceholder')).toBeInTheDocument();
  });

  it('calls login with the custom URL when entered and submitted', () => {
    render(<Header />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByPlaceholderText('header.customProviderPlaceholder'), {
      target: { value: 'https://my.custom.provider' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'header.logIn' }));
    expect(mockLogin).toHaveBeenCalledWith('https://my.custom.provider');
  });

  it('renders a "learn more" link pointing to the Solid project page', () => {
    render(<Header />);
    const link = screen.getByText('header.learnMore');
    expect(link).toHaveAttribute('href', EXTERNAL_LINKS.solidProjectAbout);
  });

  it('renders a "create pod" link with the default URL when no provider is selected', () => {
    render(<Header />);
    const link = screen.getByText('header.createPod');
    expect(link).toHaveAttribute('href', EXTERNAL_LINKS.defaultGetPod);
  });

  it('renders a "create pod" link with the provider registerUrl when a provider is selected', () => {
    const provider = SOLID_PROVIDERS.find((solidProvider) => solidProvider.registerUrl);
    if (!provider) return; // skip if no provider has a registerUrl
    render(<Header />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: provider.value } });
    const link = screen.getByText('header.createPod');
    expect(link).toHaveAttribute('href', provider.registerUrl);
  });
});

describe('Header — logged in', () => {
  beforeEach(() => {
    vi.mocked(useSolidAuth).mockReturnValue({
      session: { isLoggedIn: true, webId: 'https://user.solidcommunity.net/profile/card#me' },
      login: mockLogin,
      logout: mockLogout,
    });
  });

  it('renders the logout button', () => {
    render(<Header />);
    expect(screen.getByRole('button', { name: 'header.logOut' })).toBeInTheDocument();
  });

  it('calls logout when the logout button is clicked', () => {
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: 'header.logOut' }));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('does not render the login button when logged in', () => {
    render(<Header />);
    expect(screen.queryByRole('button', { name: 'header.logIn' })).not.toBeInTheDocument();
  });

  it('does not render the provider dropdown when logged in', () => {
    render(<Header />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('falls back to a webId-derived identifier when no profile is loaded', () => {
    render(<Header />);
    // getProfileDisplayName extracts the first meaningful segment from the WebID
    // (skipping the scheme, "profile", and "card") so the user sees a recognisable
    // host instead of the full URL.
    expect(screen.getByText('user.solidcommunity.net')).toBeInTheDocument();
  });

  it('displays profile.fn as display name when available', () => {
    vi.mocked(useSubject).mockReturnValue({ fn: 'Alice Doe' });
    render(<Header />);
    expect(screen.getByText('Alice Doe')).toBeInTheDocument();
  });

  it('displays profile.name as display name when fn is absent', () => {
    vi.mocked(useSubject).mockReturnValue({ name: 'Bob Smith' });
    render(<Header />);
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
  });

  it('displays loading text while the profile resource is loading', () => {
    vi.mocked(useResource).mockReturnValue({
      isLoading: () => true,
      isUnfetched: () => false,
      isFetched: () => false,
    });
    vi.mocked(isLoadable).mockReturnValue(true);
    render(<Header />);
    expect(screen.getByText('header.loading')).toBeInTheDocument();
  });

  it('renders the layout toggle in the logged-in branch', () => {
    render(<Header />);
    expect(screen.getByRole('group', { name: /oneDriveLayout\.layout|layout/i })).toBeInTheDocument();
  });
});

describe('Header — layout toggle visible logged out', () => {
  beforeEach(() => {
    vi.mocked(useSolidAuth).mockReturnValue({
      session: { isLoggedIn: false, webId: undefined },
      login: mockLogin,
      logout: mockLogout,
    });
  });

  it('renders the layout toggle when logged out', () => {
    render(<Header />);
    expect(screen.getByRole('group', { name: /oneDriveLayout\.layout|layout/i })).toBeInTheDocument();
  });
});

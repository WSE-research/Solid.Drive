import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {Header} from '../../src/Header';

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: vi.fn(),
  useResource: vi.fn(() => null),
  useSubject: vi.fn(() => null),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

vi.mock('../../src/LanguageSwitcher', () => ({
  LanguageSwitcher: () => null,
}));

import { useSolidAuth } from '@ldo/solid-react';

const mockLogin = vi.fn();
const mockLogout = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Header — logged out', () => {
  beforeEach(() => {
    (useSolidAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      session: { isLoggedIn: false, webId: undefined },
      login: mockLogin,
      logout: mockLogout,
    });
  });

  it('renders the brand name', () => {
    render(<Header />);
    expect(screen.getByText(/solid/i, { selector: '.site-header__brand' })).toBeInTheDocument();
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
});

describe('Header — logged in', () => {
  beforeEach(() => {
    (useSolidAuth as ReturnType<typeof vi.fn>).mockReturnValue({
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

  it('displays the webId as the user identifier', () => {
    render(<Header />);
    expect(screen.getByText('https://user.solidcommunity.net/profile/card#me')).toBeInTheDocument();
  });
});

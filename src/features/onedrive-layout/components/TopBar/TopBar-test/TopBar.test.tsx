import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopBar } from '../TopBar-file/TopBar';

const mockLogout = vi.fn();
const mockChangeLanguage = vi.fn();

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: vi.fn(() => ({
    session: { isActive: true, webId: 'https://alice.example/profile/card#me' },
    logout: mockLogout,
  })),
}));

import { useSolidAuth } from '@ldo/solid-react';

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, fallback?: string) => fallback ?? key,
    {
      resolvedLanguage: 'en',
      changeLanguage: mockChangeLanguage,
    },
  ],
}));

vi.mock('@/config', () => ({
  SUPPORTED_LANGUAGES: [
    { code: 'en', label: 'English' },
    { code: 'de', label: 'Deutsch' },
  ],
}));

vi.mock('@/features/onedrive-layout/components/NotificationBell', () => ({
  NotificationBell: () => null,
}));

const DEFAULT_PROPS = {
  searchValue: '',
  onSearchChange: () => {},
  webId: 'https://alice.example/profile/card#me',
  profileName: 'Alice Doe',
  avatarSrc: undefined as string | undefined,
};

const renderTopBar = (overrides: Partial<typeof DEFAULT_PROPS> = {}) =>
  render(<TopBar {...DEFAULT_PROPS} {...overrides} />);

beforeEach(() => {
  mockLogout.mockClear();
  mockChangeLanguage.mockClear();
  localStorage.clear();
  vi.mocked(useSolidAuth).mockReturnValue({
    session: { isActive: true, webId: 'https://alice.example/profile/card#me' },
    logout: mockLogout,
  } as unknown as ReturnType<typeof useSolidAuth>);
});

describe('TopBar — brand', () => {
  it('renders the Solid.drive logo image on the left', () => {
    renderTopBar();
    expect(screen.getByRole('img', { name: /solid\.drive/i })).toBeInTheDocument();
  });
});

describe('TopBar — search', () => {
  it('renders the search input and forwards changes', () => {
    const onSearch = vi.fn();
    renderTopBar({ onSearchChange: onSearch });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'foo' } });
    expect(onSearch).toHaveBeenCalledWith('foo');
  });

  it('reflects the controlled search value', () => {
    renderTopBar({ searchValue: 'hello' });
    expect(screen.getByRole('searchbox')).toHaveValue('hello');
  });
});

describe('TopBar — settings dropdown', () => {
  it('renders the settings (gear) trigger', () => {
    renderTopBar();
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
  });

  it('clicking the gear opens a menu with the Language label and language radios', async () => {
    const user = userEvent.setup();
    renderTopBar();
    await user.click(screen.getByRole('button', { name: /settings/i }));
    expect(await screen.findByText(/language/i)).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /english/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /deutsch/i })).toBeInTheDocument();
  });

  it('marks the resolved language as checked', async () => {
    const user = userEvent.setup();
    renderTopBar();
    await user.click(screen.getByRole('button', { name: /settings/i }));
    const english = await screen.findByRole('menuitemradio', { name: /english/i });
    expect(english).toHaveAttribute('aria-checked', 'true');
  });

  it('clicking a language radio calls i18n.changeLanguage', async () => {
    const user = userEvent.setup();
    renderTopBar();
    await user.click(screen.getByRole('button', { name: /settings/i }));
    await user.click(await screen.findByRole('menuitemradio', { name: /deutsch/i }));
    expect(mockChangeLanguage).toHaveBeenCalledWith('de');
  });

  it('settings menu exposes the layout toggle which flips the layout preference', async () => {
    localStorage.setItem('solid-drive.layout', 'onedrive');
    const user = userEvent.setup();
    renderTopBar();
    await user.click(screen.getByRole('button', { name: /settings/i }));
    const classicPill = await screen.findByRole('radio', { name: /classic/i });
    await user.click(classicPill);
    expect(localStorage.getItem('solid-drive.layout')).toBe('classic');
  });
});

describe('TopBar — avatar dropdown', () => {
  it('renders the avatar (Account) trigger', () => {
    renderTopBar();
    expect(screen.getByRole('button', { name: /account/i })).toBeInTheDocument();
  });

  it('clicking the avatar shows the display name and the WebID', async () => {
    const user = userEvent.setup();
    renderTopBar();
    await user.click(screen.getByRole('button', { name: /account/i }));
    expect(await screen.findByText('Alice Doe')).toBeInTheDocument();
    expect(screen.getByText('https://alice.example/profile/card#me')).toBeInTheDocument();
  });

  it('exposes a "View profile" link pointing at the WebID', async () => {
    const user = userEvent.setup();
    renderTopBar();
    await user.click(screen.getByRole('button', { name: /account/i }));
    const link = await screen.findByRole('menuitem', { name: /view profile/i });
    expect(link).toHaveAttribute('href', 'https://alice.example/profile/card#me');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('exposes a Log out item that calls Solid auth logout', async () => {
    const user = userEvent.setup();
    renderTopBar();
    await user.click(screen.getByRole('button', { name: /account/i }));
    await user.click(await screen.findByRole('menuitem', { name: /log out/i }));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('does not include language items in the avatar dropdown anymore', async () => {
    const user = userEvent.setup();
    renderTopBar();
    await user.click(screen.getByRole('button', { name: /account/i }));
    await screen.findByRole('menuitem', { name: /log out/i });
    expect(screen.queryByRole('menuitemradio', { name: /english/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /classic/i })).not.toBeInTheDocument();
  });
});

describe('TopBar — profile resolution branches', () => {
  it('falls back to "Signed in" placeholder when webId and profileName are empty', async () => {
    const user = userEvent.setup();
    renderTopBar({ webId: '', profileName: '' });
    await user.click(screen.getByRole('button', { name: /account/i }));
    expect(await screen.findByText(/signed in/i)).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /view profile/i })).not.toBeInTheDocument();
  });

  it('renders the profile photo as the avatar src when avatarSrc is provided', () => {
    renderTopBar({
      profileName: 'Bob Builder',
      avatarSrc: 'https://bob.example/avatar.jpg',
    });
    const avatarImg = screen.getByAltText(/bob builder/i);
    expect(avatarImg.tagName).toBe('IMG');
    expect(avatarImg).toHaveAttribute('src', 'https://bob.example/avatar.jpg');
  });

  it('always renders the centered search input', () => {
    const { container } = renderTopBar();
    expect(container.querySelector('input[type="search"]')).not.toBeNull();
  });

  describe('collapsed search overlay', () => {
    const findTrigger = (container: HTMLElement) =>
      container.querySelector('.topbar-search-trigger') as HTMLButtonElement;

    it('renders the compact search trigger anchored on the right', () => {
      const { container } = renderTopBar();
      expect(findTrigger(container)).not.toBeNull();
      const actions = container.querySelector('topbar-actions');
      expect(actions?.contains(findTrigger(container))).toBe(true);
    });

    it('opens the full-width overlay when the trigger is clicked', () => {
      const { container } = renderTopBar();
      expect(screen.queryByTestId('topbar-search-overlay')).not.toBeInTheDocument();
      fireEvent.click(findTrigger(container));
      expect(screen.getByTestId('topbar-search-overlay')).toBeInTheDocument();
    });

    it('binds the overlay input to the same searchValue / onSearchChange', () => {
      const onSearchChange = vi.fn();
      const { container } = renderTopBar({ searchValue: 'alpha', onSearchChange });
      fireEvent.click(findTrigger(container));
      const overlay = screen.getByTestId('topbar-search-overlay');
      const input = overlay.querySelector('input[type="search"]') as HTMLInputElement;
      expect(input.value).toBe('alpha');
      fireEvent.change(input, { target: { value: 'beta' } });
      expect(onSearchChange).toHaveBeenCalledWith('beta');
    });

    it('closes the overlay when the close button is clicked', () => {
      const { container } = renderTopBar();
      fireEvent.click(findTrigger(container));
      const close = screen
        .getByTestId('topbar-search-overlay')
        .querySelector('.topbar-search-overlay__close') as HTMLButtonElement;
      fireEvent.click(close);
      expect(screen.queryByTestId('topbar-search-overlay')).not.toBeInTheDocument();
    });

    it('closes the overlay when the user presses Escape inside the input', () => {
      const { container } = renderTopBar();
      fireEvent.click(findTrigger(container));
      const overlay = screen.getByTestId('topbar-search-overlay');
      const input = overlay.querySelector('input[type="search"]') as HTMLInputElement;
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(screen.queryByTestId('topbar-search-overlay')).not.toBeInTheDocument();
    });
  });
});

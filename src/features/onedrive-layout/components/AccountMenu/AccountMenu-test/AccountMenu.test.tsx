import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountMenu } from '../AccountMenu-file/AccountMenu';

const mockLogout = vi.fn();

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({
    session: { isLoggedIn: true, webId: 'https://alice.example/profile/card#me' },
    logout: mockLogout,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string, fallback?: string) => fallback ?? key],
}));

const DEFAULT_PROPS = {
  webId: 'https://alice.example/profile/card#me',
  profileName: 'Alice Doe',
  avatarSrc: undefined as string | undefined,
};

const renderMenu = (overrides: Partial<typeof DEFAULT_PROPS> = {}) =>
  render(<AccountMenu {...DEFAULT_PROPS} {...overrides} />);

describe('AccountMenu', () => {
  beforeEach(() => {
    mockLogout.mockClear();
  });

  it('renders an Account trigger button', () => {
    renderMenu();
    expect(screen.getByRole('button', { name: /account/i })).toBeInTheDocument();
  });

  it(
    'opening the menu shows the display name and the WebID',
    async () => {
      const user = userEvent.setup({ delay: null });
      renderMenu();
      await user.click(screen.getByRole('button', { name: /account/i }));
      expect(await screen.findByText('Alice Doe')).toBeInTheDocument();
      expect(screen.getByText('https://alice.example/profile/card#me')).toBeInTheDocument();
    },
    15000,
  );

  it(
    'exposes a "View profile" link pointing at the WebID',
    async () => {
      const user = userEvent.setup({ delay: null });
      renderMenu();
      await user.click(screen.getByRole('button', { name: /account/i }));
      const link = await screen.findByRole('menuitem', { name: /view profile/i });
      expect(link).toHaveAttribute('href', 'https://alice.example/profile/card#me');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    },
    15000,
  );

  it(
    'clicking Log out calls Solid auth logout',
    async () => {
      const user = userEvent.setup({ delay: null });
      renderMenu();
      await user.click(screen.getByRole('button', { name: /account/i }));
      await user.click(await screen.findByRole('menuitem', { name: /log out/i }));
      expect(mockLogout).toHaveBeenCalledTimes(1);
    },
    15000,
  );

  it(
    'falls back to "Signed in" when no profileName and no webId are provided',
    async () => {
      const user = userEvent.setup({ delay: null });
      renderMenu({ webId: '', profileName: '' });
      await user.click(screen.getByRole('button', { name: /account/i }));
      expect(await screen.findByText(/signed in/i)).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /view profile/i })).not.toBeInTheDocument();
    },
    15000,
  );

  it('renders the avatar image when avatarSrc is provided', () => {
    renderMenu({ profileName: 'Bob Builder', avatarSrc: 'https://bob.example/avatar.jpg' });
    const avatarImg = screen.getByAltText(/bob builder/i);
    expect(avatarImg.tagName).toBe('IMG');
    expect(avatarImg).toHaveAttribute('src', 'https://bob.example/avatar.jpg');
  });
});
